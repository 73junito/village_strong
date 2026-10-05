# Agent Orchestration Layer

A ten-gate release pipeline for Village Strong course and assessment content.

```
Evidence → Rights → Curriculum → Question → Technical Review
        → Instructional Review → Assessment Governance
        → Software Engineering → Validation → Release
```

Each agent is a gate. It inspects a release candidate and either **clears** it or
raises **blockers** that stop the run. Nothing reaches Release until all seven
preceding gates have cleared and Validation has independently re-confirmed them.

## The lifecycle

```
        any blocker                ten gates cleared
HELD  ───────────────────▶  HELD          AWAITING_APPROVAL
                                           │
                                           │ named human approval,
                                           │ matching run id,
                                           │ matching request hash
                                           ▼
                                        RELEASED
```

**Ten passing agents do not produce a release.** They produce `AWAITING_APPROVAL`,
and the workflow stops there durably. The Release Agent cannot move a run past
that point; it only records the verdict. `RELEASED` is reachable in exactly one
place: `src/approval.ts`, after an approval that names an actor, a reason, a
timestamp, the run id, and the SHA-256 of the reviewed submission and artifacts.

`HELD` is terminal. A blocker is a refusal, not a question, and no signature can
overrule one.

### Why the hash

Without it, an approval collected for one clean run could be replayed against a
submission that changed afterwards. `computeReviewHash` is **recomputed** at the
boundary rather than trusted from the request, so a modified submission fails
closed with `REQUEST_HASH_MISMATCH`. The `release` artifact is deliberately
excluded from the hash input, because it records the approval decision itself and
would otherwise depend on its own output.

### Idempotency

A repeated approval returns the original record and performs no second release.
The comparison is against the **whole** stored record, not just the run id and
hash — otherwise anyone who knew those two could replay an approval under their
own name and have it treated as a harmless duplicate.

## Why a separate Worker

This is its own Cloudflare Worker (`village-strong-orchestrator`), not a route in
`apps/web`. `village-strong` owns `villagestrongfoundation.org` and `www`; keeping
the pipeline separate means a held release can never interfere with the live
site, and a website deploy can never disturb an in-flight pipeline run.

It shares **no** domains, routes, data, identity, secrets, Durable Object
namespaces or admin interfaces with `village-strong`.

## Layout

| Path | Purpose |
|------|---------|
| `src/types.ts` | Domain contracts: `Submission`, `Item`, `Asset`, `Finding` |
| `src/checks.ts` | `FindingLog`, artifact publish/read helpers |
| `src/agents/admissibility.ts` | Evidence, Rights |
| `src/agents/design.ts` | Curriculum, Question |
| `src/agents/reviewers.ts` | Technical Review, Instructional Review |
| `src/agents/governance.ts` | Assessment Governance |
| `src/agents/shipping.ts` | Software Engineering, Validation |
| `src/agents/release.ts` | Release |
| `src/pipeline.ts` | Gate order + the pure engine |
| `src/workflow.ts` | Durable Workflow: one `step.do()` per gate |
| `src/agent.ts` | Durable Object that owns runs |
| `src/index.ts` | Worker entry: JSON API + Agent routing |

### The split that makes this testable

`src/pipeline.ts` and `src/agents/**` import **nothing** from Workers, Durable
Objects or the Agents SDK. They are plain functions over a plain object. That is
what allows all sixteen tests to run under plain `node --test`, with no
`workerd`, no Miniflare and no network.

`src/workflow.ts` adds durability by calling `runAgent()` exactly once per
`step.do()`, and `runPipeline()` is defined in terms of the same function. The
durable path and the CLI therefore cannot drift: a verdict shown by
`npm run review` is the verdict the workflow will reach.

## Running it

```bash
npm install
npm run cf:types           # generate env.d.ts from wrangler.jsonc (gitignored)
npm run check              # types (3 configs) + unit + workerd integration
npm run test:unit          # node --test, no runtime
npm run test:integration   # vitest on workerd
npm run review fixtures/clean.json
npm run review fixtures/held.json   # exits 1, prints the hold
```

`npm run review` prints the same gate decisions the workflow makes:

```
course: heroes-path-week-1
gates:  10 executed

 1. PASS  Evidence Agent
 2. PASS  Rights Agent
 3. PASS  Curriculum Agent
 4. PASS  Question Agent
      warn QUESTION-004 [o3-i1]
      Item "o3-i1" has no rationale for its key.
...
10. PASS  Release Agent
      info RELEASE-004
      All ten agents cleared. The run is awaiting a named human approval.

AWAITING_APPROVAL — all ten agents cleared. A named human approval is required before release.
```

It exits non-zero only when a run is **held**. A clean run exits 0, because
stopping short of a release is the correct outcome. **The CLI has no approval
path at all** — it cannot release anything, by design.

## HTTP API

Everything except `/healthz` and `/api/pipeline` requires
`Authorization: Bearer $ORCHESTRATOR_API_TOKEN`. **If that secret is not
configured the API returns 503 and authorises nothing** — an unconfigured
deployment is a broken deployment, never an open one.

`approvedBy` is **not** taken from the request body. It comes from
`ORCHESTRATOR_APPROVER`, the identity behind the token; anything the caller
claims about who they are is overwritten before validation.

If `ORCHESTRATOR_APPROVER` is unset, **approvals fail closed with 503**. There
is no placeholder identity: an approval signed by `"token-holder"` would
attribute a release to nobody, which is the same defect as letting the caller
name themselves. The refusal is scoped to approval — rejecting is always safe,
and status reads stay available so an operator can diagnose a stuck run.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/healthz` | Liveness plus the gate count *(public)* |
| `GET` | `/api/pipeline` | The ten gates in order, no Durable Object *(public)* |
| `POST` | `/api/runs` | Start a run; returns `{ "runId": "..." }` with `202` |
| `GET` | `/api/runs` | Recent runs |
| `GET` | `/api/runs/:id` | One run's status |
| `POST` | `/api/runs/:id/approve` | Submit an approval; `202` accepted, `422` refused |
| `POST` | `/api/runs/:id/reject` | Reject a pending run |
| `*` | `/agents/...` | Agent SDK routing: HTTP and WebSocket |

```bash
npx wrangler secret put ORCHESTRATOR_API_TOKEN   # once, before the API works
npx wrangler secret put ORCHESTRATOR_APPROVER    # the accountable human

curl -X POST localhost:8787/api/runs \
  -H "authorization: Bearer $ORCHESTRATOR_API_TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"submission\": $(cat fixtures/clean.json)}"
# -> 202 {"runId":"<uuid>","status":"queued"}   (returns immediately)
```

Poll the run. It stops at `AWAITING_APPROVAL` with the `requestHash` you are
authorising:

```bash
curl localhost:8787/api/runs/$RUN_ID -H "authorization: Bearer $ORCHESTRATOR_API_TOKEN"
```

Approve it by echoing that hash back — the hash is what you are signing. There
is no `approvedBy` in the body; it is taken from the token:

```bash
curl -X POST localhost:8787/api/runs/$RUN_ID/approve \
  -H "authorization: Bearer $ORCHESTRATOR_API_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"runId":"'"$RUN_ID"'","reason":"Reviewed in council.","approvedAt":"2026-10-05T09:30:00.000Z","requestHash":"'"$HASH"'"}'
# -> 202 accepted, or 422 refused with a reason
```
## How the gates differ

The three reviewers deliberately hold separate mandates, because collapsing them
lets content through that is clean on one axis and hollow on another.

- **Technical Review** asks *is this correct and gradable?* It blocks an item
  whose key points at an option the item never offers, and a numeric item with no
  tolerance, because the grader cannot accept an answer.
- **Instructional Review** asks *does this teach and measure what it claims?* It
  warns when an `analyze`-level objective is assessed only by recall items.
- **Assessment Governance** asks *is this fair to score a young person with?* It
  counts coverage per objective rather than across the bank, so 40 items aimed at
  one objective do not masquerade as thorough coverage of the course.

**Warnings never halt a run.** Only blockers do. `fixtures/clean.json` ships with
two live warnings and still reaches Release.

### Consent is not a licence

`Asset.depictsPeople` is an explicit field rather than an inference from `kind`.
An image may be a logo that shows nobody, and an audio clip may record a voice,
so tying the rule to the file format would either block the banner or push
authors to misdescribe their assets. `RIGHTS-005` blocks on the flag, not the
format.

### Validation re-derives, it does not trust

`Validation` re-reads all seven upstream artifacts and blocks if any is missing
or uncleared (`VALIDATION-001`, `VALIDATION-002`). This is what catches a stage
that silently reported success, which a pipeline that only checked "did the
previous step throw?" would let straight through.

## Determinism

Agents never read the clock. `runPipeline(submission, now)` takes the timestamp as
a parameter, and the workflow passes `event.timestamp`. Replaying a durable step
therefore cannot rewrite an artifact an earlier step already committed — a real
risk here, because step outputs share the `Submission` that later gates read.

## Approval identity (OIDC, per person)

Approvals are authenticated with **OIDC**, not a shared secret. All verification
is delegated to [`jose`](https://github.com/panva/jose) — JWKS resolution, key
selection by `kid`/`alg`/`use`/`key_ops`, signature, issuer, audience and expiry.
None of that is hand-rolled here, because that surface is where auth bugs live.

| Requirement | Where |
|---|---|
| Signature, issuer, audience, expiry | `verifyApprovalIdentity` via `jose.jwtVerify` |
| Algorithm pinning | `PERMITTED_ALGS` — asymmetric only; never `none`, never HS* |
| Key rotation | `createRemoteJWKSet` caches and refetches on an unknown `kid` |
| `approvedBy` | `<issuer>#<subject>` — registered claims only |
| Display data | `displayName` / `email`, carried separately, never the actor |
| Role enforcement | `OIDC_ROLE_CLAIM` ∩ `OIDC_APPROVER_ROLES`, checked *after* auth |
| Replay | `nonce` must equal the run-bound approval nonce |
| Audit | issuer, subject, `authenticatedAt`, run id, reviewed hash, reason |

**The actor is never an email or a name.** Both are display data an issuer may
let a user edit; only `iss` + `sub` identify a person. That is why
`approvedBy` reads `https://idp.example/#user-123` and not `dana@example.org`.

Every failure is a refusal, never a fallback:

| Condition | Outcome |
|---|---|
| Any OIDC setting missing | `CONFIG_MISSING` — including an **empty allowlist** |
| Expired token | `EXPIRED` |
| Wrong issuer or audience | `TOKEN_INVALID` |
| Bad signature, forged token, unknown `kid` | `SIGNATURE_INVALID` |
| No approver role | `ROLE_MISSING` |
| Nonce from another run, or absent | `NONCE_MISMATCH` |

An empty `OIDC_APPROVER_ROLES` must mean **nobody**, never everybody. That
default is asserted in the suite.

### Configuration

All provider-specific values come from configuration, so changing identity
provider needs no code change:

```
OIDC_ISSUER           https://idp.example/
OIDC_AUDIENCE         village-strong-orchestrator
OIDC_JWKS_URL         https://idp.example/.well-known/jwks.json
OIDC_ROLE_CLAIM       roles
OIDC_APPROVER_ROLES   release-approver,curriculum-chair
```

### Testing

`tests/oidc.test.ts` generates a real RSA keypair in-process and publishes a real
JWKS, then exercises the same `jwtVerify` path production uses. **CI never
contacts an identity provider.** Negative cases cover expiry, wrong issuer,
wrong audience, forged signature, unknown `kid`, missing role, missing role
claim, cross-run nonce replay, absent nonce, malformed tokens, and every missing
configuration key.

## Approval sessions (run-bound nonce, state, PKCE)

> **Status: primitives and durable ledger only.** There is deliberately **no**
> authorization URL, callback route, token exchange, client secret or redirect
> URI here. Those arrive with the real identity provider. This layer is the part
> that must never be wrong, so it is built and tested in isolation rather than
> against a fictional provider contract.

A session is the durable state one approval attempt needs:

| Value | Stored as | Why |
|---|---|---|
| OIDC `nonce` | SHA-256 hash | Must be unguessable to stop replay |
| OAuth `state` | SHA-256 hash | Must be unguessable to stop response injection |
| PKCE verifier | **plaintext** | The token exchange must send it verbatim |
| PKCE challenge | plaintext | `BASE64URL(SHA256(verifier))`, travels to the IdP |
| `createdAt` / `expiresAt` | plaintext | 10-minute TTL |
| `consumedAt` | plaintext, write-once | One-time use |

Only hashes of `nonce` and `state` are stored, so a ledger read cannot
reconstruct either secret. The PKCE verifier is stored in the clear **by
design** — hashing it would break the exchange; its protection is that it exists
only in this run's ledger.

### Rules enforced

- **Created only for `AWAITING_APPROVAL`.** A `HELD` run gets no nonce, and
  neither does a running or already-released one.
- **One nonce, one run, one use.** A session is bound to `runId`; re-minting
  replaces the previous session rather than leaving two live nonces.
- **A failed attempt does not consume.** Wrong `state` or a foreign nonce leaves
  the session spendable, so a reviewer can correct the flow and retry.
- **Consumption is atomic and write-once.** Two concurrent callbacks serialise on
  the Durable Object, so the loser observes `consumedAt` already set. `consumedAt`
  is never rewritten or cleared.
- **Cross-run replay fails.** A nonce legitimately issued for run A does not
  verify against run B.

### Two independent controls

The session and the reviewed-artifact hash are **not** redundant:

- The **nonce** stops an authenticated approval being replayed — it authorises
  the *act*.
- The **artifact hash** proves *what* the person approved — it covers the content.

Either alone is insufficient: without the hash a valid nonce could approve a
changed submission; without the nonce an approval could be reused.

### Deadlock safety

Session creation and consumption are **Worker → Durable Object** RPCs, not
**Workflow → Durable Object** callbacks. The re-entrancy cycle that bit us
earlier only occurs when a workflow calls back into an object whose own request
is still open, so this layer cannot reintroduce it.

## The deadlock this design avoids

A Durable Object handles one request at a time, and the workflow reports back
into the same object. An earlier version started the workflow *inside* the
request that created it:

```
request -> Orchestrator (lock held) -> workflow -> reportProgress
        -> Orchestrator (locked) -> deadlock
```

The two waited on each other until the request was cancelled. It was an
architecture defect, not a Miniflare limitation, and it is now prevented
structurally rather than by timing:

1. **Reserve, then dispatch.** `reserveRun` records the run and returns.
   `dispatchRun` starts the workflow and returns immediately. No request ever
   both starts a workflow and stays open while it runs.
2. **No callbacks inside the gate loop.** The workflow makes no call into the
   Durable Object until all ten gates have completed. Gate-level progress is
   read from the workflow's own durable step history instead.
3. **`waitUntil` holds creation alive** without the caller waiting on it.

The workerd suite now exercises the whole path — start, park, approve, release —
so a regression cannot come back silently.

## Assumptions and limitations

- **Identity is a token, not a person.** `approvedBy` is derived from
  `ORCHESTRATOR_APPROVER` and any identity in the request body is discarded, so
  a caller cannot sign as somebody else. If `ORCHESTRATOR_APPROVER` is unset,
  approvals are refused outright. But a single shared token still cannot
  distinguish the Program Director from anyone else holding it; replacing it
  with per-approver credentials (OIDC or mTLS) is required before deployment.
- **The API is single-tenant.** One orchestrator instance (`release-orchestrator`)
  serves every caller. Multi-tenancy is not designed in.
- **A dispatch failure is visible, not silent.** `dispatchRun` hands creation to
  `waitUntil`; if the object is evicted first, the ledger row stays `queued`,
  which is exactly what `GET /api/runs/:id` reports.
- **`wrangler.test.jsonc` restates the bindings in `wrangler.jsonc`** because the
  test pool bundles an older Wrangler that cannot parse the declarative `exports`
  map. `tests/config.test.ts` fails if the two ever disagree.
- **No staging hostname or private service binding yet.** `workers_dev` is
  `false` and there are no routes, so this Worker currently has **no** reachable
  endpoint. Wiring one up is a deployment decision.
- **No persistence beyond the Workflow history and the run ledger.** The ledger
  is capped at the runs currently in state; there is no submission store.
- **The gates are deterministic rules, not LLM calls.** Each agent is a pure
  function, so an LLM-backed implementation can be substituted per stage without
  changing the workflow.
- **Not deployed.** The bundle is validated with `wrangler deploy --dry-run`
  only; no Worker named `village-strong-orchestrator` has been created.