#!/usr/bin/env node
/**
 * Cross-platform replacement for scripts/validate-artifact.sh.
 *
 * Confirms the build produced a deployable Cloudflare Worker: the ESM bundle
 * must export a default object with a `fetch(request, env, ctx)` method.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerPath = resolve(projectRoot, "dist/server/index.js");

if (!existsSync(workerPath)) {
  console.error("Missing Cloudflare Worker entry: dist/server/index.js");
  console.error("Run `npm run build` first.");
  process.exit(66);
}

// Cache-bust the import so repeated runs in one process re-evaluate the bundle.
const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("cloudflare-validation", `${process.pid}-${Date.now()}`);

const worker = await import(workerUrl.href);

if (!worker.default || typeof worker.default.fetch !== "function") {
  console.error(
    "dist/server/index.js must export a default Worker with fetch(request, env, ctx)",
  );
  process.exit(1);
}

console.log("Validated Cloudflare artifact: ESM Worker default.fetch is present.");
