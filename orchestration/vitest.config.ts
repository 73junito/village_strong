import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run inside real workerd.
 *
 * `node --test` covers the pure engine, but it cannot exercise the parts this
 * project actually gets wrong in production: whether the Durable Object and
 * Workflow bindings resolve, whether a run really pauses durably at the approval
 * boundary, and whether the authenticated HTTP surface refuses what it should.
 * Those need a real runtime, so they get a real runtime.
 *
 * Only the integration suite runs here; the unit tests stay on `node --test`
 * with no runtime at all. They live in separate tsconfigs because the two
 * environments declare conflicting globals.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            // The test pool's bundled Wrangler cannot parse the declarative
            // `exports` map in wrangler.jsonc, so the integration suite loads a
            // restated copy in the older `migrations` syntax. The bindings are
            // identical; keep the two files in step.
            wrangler: { configPath: "./wrangler.test.jsonc" },
            miniflare: {
              bindings: {
                // Test-only values. Never real secrets.
                ORCHESTRATOR_API_TOKEN: "test-token-do-not-use",
                // The principal that `approvedBy` is derived from. Without it the
                // approval path fails closed, which is correct — so it must be
                // present for the release-path tests to reach the boundary.
                ORCHESTRATOR_APPROVER: "D. Rodriguez (Program Director)",
              },
            },
          }),
        ],
        test: {
          name: "workers",
          include: ["tests/integration/**/*.test.ts"],
          // Vitest 4 moved poolOptions to the top level of `test`, and this pool
          // version no longer exposes `isolatedStorage` at all. Tests here must
          // therefore not rely on per-test Durable Object rollback: each uses a
          // distinct course id so runs cannot collide.
          pool: "threads",
          maxWorkers: 1,
        },
      },
    ],
  },
});