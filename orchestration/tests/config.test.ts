import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Deployment-boundary and configuration-parity checks.
 *
 * These live in the Node suite rather than the workerd suite on purpose:
 * workerd's module sandbox roots at /bundle and cannot read the project's
 * wrangler files, so a config assertion there would test nothing.
 */

/**
 * Wrangler configs are JSONC, so a plain JSON.parse would fail on the comments
 * that carry the reasoning. Strip block and line comments, plus the trailing
 * commas left behind, before parsing.
 */
function readConfig(path: string): Record<string, unknown> {
  const raw = readFileSync(path, "utf8");
  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");

  return JSON.parse(withoutComments.replace(/,(\s*[}\]])/g, "$1")) as Record<
    string,
    unknown
  >;
}

/**
 * A canonical description of everything the Worker binds.
 *
 * The test pool ships an older Wrangler that cannot parse the declarative
 * `exports` map, so wrangler.test.jsonc restates the same bindings in the older
 * `migrations` syntax. That duplication is a silent-drift hazard: add a binding
 * to one file and the integration suite keeps testing a Worker that is not the
 * one that ships. Comparing a signature rather than the raw files, because the
 * two legitimately differ in syntax.
 */
function bindingSignature(config: Record<string, unknown>): string {
  const durableObjects = config.durable_objects as
    | { bindings?: { name: string; class_name: string }[] }
    | undefined;
  const workflows =
    (config.workflows as { binding: string; class_name: string; name: string }[]) ?? [];

  return JSON.stringify({
    durable: (durableObjects?.bindings ?? []).map((b) => [b.name, b.class_name]),
    workflows: workflows.map((w) => [w.binding, w.class_name, w.name]),
  });
}

test("wrangler.jsonc and wrangler.test.jsonc declare identical bindings", () => {
  assert.equal(
    bindingSignature(readConfig("wrangler.test.jsonc")),
    bindingSignature(readConfig("wrangler.jsonc")),
  );
});

test("the deployable config exposes no public surface", () => {
  const deploy = readConfig("wrangler.jsonc");

  // workers.dev would publish an internet endpoint for an API that can release
  // content; routes or a custom domain would put it on a public hostname.
  assert.equal(deploy.workers_dev, false);
  assert.equal(deploy.routes, undefined);
  assert.equal(deploy.custom_domain, undefined);
});

test("the deployable config is separate from the production site", () => {
  const deploy = readConfig("wrangler.jsonc");

  // `village-strong` owns villagestrongfoundation.org. Reusing its name would
  // update the live Worker instead of creating a separate one.
  assert.equal(deploy.name, "village-strong-orchestrator");
  assert.notEqual(deploy.name, "village-strong");
});

test("both configs require the Agents SDK compatibility flag", () => {
  for (const path of ["wrangler.jsonc", "wrangler.test.jsonc"]) {
    const config = readConfig(path);
    assert.deepEqual(config.compatibility_flags, ["nodejs_compat"], `${path} must set nodejs_compat`);
  }
});

/** The package scripts, which are the only way CI or a human can deploy. */
function readScripts(): Record<string, string> {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts ?? {};
}

/** The CI workflow, one directory above the orchestration package. */
function readCI(): string {
  return readFileSync("../.github/workflows/ci.yml", "utf8");
}

/**
 * `wrangler deploy` with no `--config` reads wrangler.jsonc, whose `name` is
 * `village-strong-orchestrator`. That Worker does not exist, so an unqualified
 * deploy would *create* it — publishing an API that can release content. The
 * ambiguous scripts are removed rather than renamed, because a rename that still
 * resolves to the base config preserves the hazard under a new label.
 */
test("the ambiguous generic deploy commands are forbidden", () => {
  const scripts = readScripts();

  assert.equal(
    scripts.deploy,
    undefined,
    "`deploy` resolves to the base config and can create the production-named Worker",
  );
  assert.equal(
    scripts["deploy:dry-run"],
    undefined,
    "`deploy:dry-run` is the ambiguous name CI previously invoked",
  );
});

/**
 * The base config still needs a pre-deploy validation in CI, but only under a
 * name that says what it actually does. It must name the config explicitly and
 * must carry `--dry-run`, so the command cannot write to the Cloudflare API
 * even if the config argument were later dropped from another script.
 */
test("check:private-config explicitly validates the base config without deploying", () => {
  const script = readScripts()["check:private-config"];

  assert.ok(script, "CI depends on this exact script name");
  assert.match(script, /wrangler deploy/, "must be a deploy-bundle validation");
  assert.match(script, /--config wrangler\.jsonc/, "must name the base config explicitly");
  assert.match(script, /--dry-run/, "must never write to the Cloudflare API");
  assert.doesNotMatch(script, /staging/, "this command must not resolve to any staging config");
});

test("CI invokes check:private-config and no ambiguous deploy command", () => {
  const ci = readCI();

  assert.match(ci, /npm run check:private-config/, "CI must validate the base config by its explicit name");
  assert.doesNotMatch(ci, /npm run deploy:dry-run/, "the removed script must not be called");

  // `npm run deploy:check` in the web job is a different package and is fine;
  // this forbids only a bare `npm run deploy`, which resolves to the production
  // name in whichever package the step runs.
  assert.doesNotMatch(ci, /^\s*run:\s*npm run deploy\s*$/m, "no step may run an unqualified deploy");
});

test("no CI step deploys for real", () => {
  for (const line of readCI().split("\n")) {
    if (line.includes("wrangler deploy") && !line.includes("--dry-run")) {
      assert.fail(`CI step writes to the Cloudflare API: ${line.trim()}`);
    }
  }
});

/**
 * The two exposure assertions live in "the deployable config exposes no public
 * surface" above and still hold: base is `workers_dev: false` with no `routes`
 * and no `custom_domain`. Restated here so the deployment-boundary suite is
 * self-contained — these three lines are the boundary itself, and a reader
 * scanning for it should not have to find a second test.
 */
test("the base config stays private", () => {
  const deploy = readConfig("wrangler.jsonc");

  assert.equal(deploy.workers_dev, false, "base must not publish a *.workers.dev hostname");
  assert.equal(deploy.routes, undefined, "base must carry no routes");
  assert.equal(deploy.custom_domain, undefined, "base must carry no custom domain");
  assert.equal(deploy.name, "village-strong-orchestrator");
});