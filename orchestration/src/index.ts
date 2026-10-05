/**
 * Worker entry point.
 *
 * Two surfaces:
 *   /api/...    a small JSON API for starting and inspecting release runs
 *   /agents/... the SDK's Agent routing (HTTP and WebSocket)
 *
 * Everything else is a 404, deliberately: this Worker exposes no public content
 * and must never answer a bare 200 that could be mistaken for the website.
 */
import { getAgentByName, routeAgentRequest } from "agents";

import {
  approvalRefusal,
  resolveActor,
  tokensMatch,
  type Principal,
} from "./auth.ts";
import { PIPELINE } from "./pipeline.ts";
import { OrchestratorAgent } from "./agent.ts";
import type { ReleaseRequest } from "./workflow.ts";

/**
 * Both classes are re-exported because `wrangler.jsonc` declares them by
 * `class_name`, and Wrangler refuses to build a bundle in which a declared
 * Durable Object or Workflow is not exported from the entrypoint:
 *
 *     "Your Worker depends on the following Durable Objects, which are not
 *      exported in your entrypoint file: OrchestratorAgent."
 *
 * The export names must match `class_name` exactly, so neither may be aliased.
 */
export { OrchestratorAgent } from "./agent.ts";
export { ReleasePipelineWorkflow } from "./workflow.ts";

/** Name of the single orchestrator instance; the API is single-tenant. */
const INSTANCE = "release-orchestrator";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Resolves the single orchestrator instance.
 *
 * Two things are made explicit here. The type argument, because `getAgentByName`
 * otherwise widens to the base `Agent` and erases `startRelease`/`getRun`/
 * `listRuns` from every call site. And the namespace cast, because the generated
 * `Env` types a Durable Object binding as an unparameterised
 * `DurableObjectNamespace` and so cannot know which class it holds; wrangler
 * derives the binding from wrangler.jsonc, so the pairing is checked at deploy
 * time even though the compiler cannot check it here.
 */
function orchestrator(env: OrchestratorEnv) {
  // Cast through `unknown` because the generated binding is typed as
  // `DurableObjectNamespace<undefined>`, which shares no members with the real
  // class, so TypeScript rejects a direct assertion.
  return getAgentByName<Env, OrchestratorAgent>(
    env.OrchestratorAgent as unknown as DurableObjectNamespace<OrchestratorAgent>,
    INSTANCE,
  );
}

/** Bindings declared in wrangler.jsonc, plus the API token secret. */
type OrchestratorEnv = Env & {
  /** `wrangler secret put ORCHESTRATOR_API_TOKEN`. Absent means the API is shut. */
  ORCHESTRATOR_API_TOKEN?: string;
  /**
   * The accountable human behind the token, written into `approvedBy`.
   * `wrangler secret put ORCHESTRATOR_APPROVER`.
   */
  ORCHESTRATOR_APPROVER?: string;
};


/**
 * Public paths. `/healthz` and `/api/pipeline` expose no content and no run
 * data, so they stay reachable for liveness checks. Everything else requires a
 * token.
 */
const PUBLIC_PATHS = new Set(["/healthz", "/api/pipeline"]);

/**
 * Resolves the caller from the bearer token, or returns a refusal response.
 *
 * Fails closed on the token: if that secret is missing, nothing is authorised.
 * An unconfigured deployment is a broken deployment, never an open one. The
 * approver identity is resolved but NOT defaulted — `approvalRefusal` refuses
 * approvals when it is absent.
 */
function authenticate(request: Request, env: OrchestratorEnv): Principal | Response {
  const expected = env.ORCHESTRATOR_API_TOKEN;
  if (!expected) {
    return json(
      { error: "The orchestrator API is disabled: ORCHESTRATOR_API_TOKEN is not configured." },
      503,
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1]?.trim();

  if (!provided || !tokensMatch(provided, expected)) {
    return json({ error: "Unauthorized." }, 401);
  }

  return { actor: resolveActor(env.ORCHESTRATOR_APPROVER), token: provided };
}


/** Returns the refusal response, or null when the caller is authenticated. */
function denied(auth: Principal | Response): Response | null {
  return auth instanceof Response ? auth : null;
}

export default {
  async fetch(request: Request, env: OrchestratorEnv): Promise<Response> {
    const url = new URL(request.url);

    // Agent routing must be tried before the API so `/agents/...` paths are
    // never shadowed, and it owns both HTTP and WebSocket upgrades.
    const routed = await routeAgentRequest(request, env);
    if (routed) return routed;

    // Every non-public route carries a verified principal from here on.
    let auth: Principal | Response = { actor: "", token: "" };
    if (!PUBLIC_PATHS.has(url.pathname)) {
      auth = authenticate(request, env);
      const refusal = denied(auth);
      if (refusal) return refusal;
    }
    const principal = auth as Principal;

    if (url.pathname === "/healthz") {
      return json({ status: "ok", gates: PIPELINE.length });
    }

    // The pipeline definition is public and static, so it is answered without
    // touching a Durable Object.
    if (url.pathname === "/api/pipeline") {
      return json(
        PIPELINE.map((agent, index) => ({
          position: index + 1,
          stage: agent.stage,
          agent: agent.title,
        })),
      );
    }

    if (url.pathname === "/api/runs" && request.method === "POST") {
      return startRun(request, env);
    }

    if (url.pathname === "/api/runs" && request.method === "GET") {
      const agent = await orchestrator(env);
      return json({ runs: await agent.listRuns(20) });
    }

    const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/(approve|reject)$/);
    if (runMatch && request.method === "POST") {
      return decideRun(request, env, principal, runMatch[1]!, runMatch[2] as "approve" | "reject");
    }

    // Approval-session plumbing only. There is deliberately NO authorization URL,
    // callback route, token exchange or provider coupling here: those arrive with
    // the real identity provider. What lives here is the run-bound nonce/state/
    // PKCE ledger, which is the part that must never be wrong.
    const sessionMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/(session|approve-session)$/);
    if (sessionMatch && request.method === "POST") {
      const runId = sessionMatch[1]!;
      const isConsume = sessionMatch[2] === "approve-session";

      const agent = await orchestrator(env);
      const now = Date.now();

      if (!isConsume) {
        const started = await agent.beginApprovalSession(runId, now);
        if (!started.started) {
          return json({ error: started.reason }, started.reason === "Unknown run." ? 404 : 422);
        }
        return json(started.issued, 200);
      }

      let body: { state?: unknown; nonce?: unknown; consume?: unknown; now?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "Expected a JSON body." }, 400);
      }

      // `now` is injectable so expiry is testable without waiting out the TTL.
      const at = typeof body.now === "number" ? body.now : now;
      const state = typeof body.state === "string" ? body.state : "";
      const nonce = typeof body.nonce === "string" ? body.nonce : "";

      const stateCheck = await agent.checkApprovalSessionFor(runId, state, at);
      if (!stateCheck.ok) return json({ error: stateCheck.message, reason: stateCheck.reason }, 422);

      const nonceCheck = await agent.checkApprovalNonce(runId, nonce);
      if (!nonceCheck.ok) return json({ error: nonceCheck.message, reason: nonceCheck.reason }, 422);

      // Consumption only happens once every check has passed, so a failed
      // attempt never burns the session.
      if (body.consume === true) {
        const consumed = await agent.consumeApprovalSession(runId, at);
        if (!consumed.consumed) {
          return json({ error: consumed.message, reason: consumed.reason }, 422);
        }
      }

      return json({ ok: true, pkceChallenge: stateCheck.pkceChallenge }, 200);
    }

    const getMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (getMatch && request.method === "GET") {
      // `noUncheckedIndexedAccess` makes the capture optional; the regex only
      // matches when it is present, so this is a narrowing, not a guess.
      const runId = getMatch[1];
      if (!runId) return json({ error: "Not found." }, 404);

      const agent = await orchestrator(env);

      // Read the ledger first. An unknown id must answer 404 rather than report
      // an empty workflow object, which would read as "a run that exists and has
      // done nothing".
      // RPC: an await is required even though the method itself is synchronous.
      const ledger = await agent.getLedgerRun(runId);
      if (!ledger) return json({ error: "Unknown run." }, 404);

      return json({
        runId,
        status: ledger.status,
        decision: ledger.decision ?? null,
        haltedAt: ledger.haltedAt ?? null,
        pendingApproval: ledger.pendingApproval ?? null,
        workflow: (await agent.getRun(runId)) ?? null,
      });
    }

    return json({ error: "Not found." }, 404);
  },
} satisfies ExportedHandler<OrchestratorEnv>;

/**
 * Starts a release run.
 *
 * The body is validated here rather than inside the agent so a malformed request
 * produces a 400 to the caller instead of an opaque failure inside a Durable
 * Object that nobody is watching.
 */
async function startRun(request: Request, env: OrchestratorEnv): Promise<Response> {
  let body: ReleaseRequest;
  try {
    body = (await request.json()) as ReleaseRequest;
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const submission = body?.submission;
  if (!submission || typeof submission !== "object") {
    return json({ error: "`submission` is required." }, 400);
  }

  for (const field of ["courseId", "sources", "assets", "objectives", "items"] as const) {
    if (submission[field] === undefined) {
      return json({ error: "`submission." + field + "` is required." }, 400);
    }
  }

  const agent = await orchestrator(env);

  // The run id is minted here, at the edge, so the caller is handed an id in the
  // same round trip. The workflow is started in a SECOND call that returns
  // immediately, because a Durable Object that both starts a workflow and stays
  // open while it runs deadlocks against that workflow's first callback.
  const runId = crypto.randomUUID();

  await agent.reserveRun(body, runId);
  await agent.dispatchRun(body, runId);

  return json({ runId, status: "queued" }, 202);
}

/**
 * Approve or reject a run that is waiting at the approval boundary.
 *
 * The body is passed through untouched. Every field is re-validated inside the
 * workflow, so a value this handler accepts can still be refused downstream;
 * that ordering is deliberate, because the edge is not the trust boundary.
 */
async function decideRun(
  request: Request,
  env: OrchestratorEnv,
  principal: Principal,
  runId: string,
  action: "approve" | "reject",
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const agent = await orchestrator(env);

  if (action === "reject") {
    const reason =
      body && typeof (body as { reason?: unknown }).reason === "string"
        ? ((body as { reason: string }).reason || "Rejected without a stated reason.")
        : "Rejected without a stated reason.";

    return json(await agent.rejectRun(runId, reason));
  }

  // Fail closed on a missing approver identity.
  //
  // Without this, an unset ORCHESTRATOR_APPROVER would let an approval through
  // with a placeholder actor, producing a release attributed to nobody. Scoped
  // to approval: rejecting is always safe, and status reads stay available so an
  // operator can still see why a release is stuck.
  if (action === "approve") {
    const refusal = approvalRefusal(principal);
    if (refusal) return json({ error: refusal }, 503);
  }

  // `principal.actor` overrides anything the body claimed about who is approving.
  const result = await agent.approveRun(runId, body, principal.actor as string);

  // A refusal is reported as 422, not 202: the approval was understood and
  // declined, and the caller needs to distinguish that from an accepted one.
  return result.accepted ? json(result, 202) : json(result, 422);
}
