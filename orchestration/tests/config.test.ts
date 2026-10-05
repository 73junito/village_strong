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