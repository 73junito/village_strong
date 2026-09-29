#!/usr/bin/env node
/**
 * Cross-platform replacement for scripts/build-verified.sh.
 *
 * Runs the vinext build under a bounded timeout, then validates that the
 * result is a deployable Cloudflare Worker. A timeout or a failed build is a
 * hard failure; the build is never retried automatically.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vinextBin = resolve(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vinext.cmd" : "vinext",
);

if (!existsSync(vinextBin)) {
  console.error("vinext is unavailable. Run `npm install` before building.");
  process.exit(69);
}

/** Parse a duration such as "3m" or "90s" into milliseconds. */
function parseDuration(value, fallbackMs) {
  if (!value) return fallbackMs;
  const match = /^(\d+)(ms|s|m)?$/.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  const scale = { ms: 1, s: 1000, m: 60_000 }[unit];
  return amount * scale;
}

const timeoutMs = parseDuration(process.env.SITES_BUILD_TIMEOUT, 3 * 60_000);
const killAfterMs = parseDuration(process.env.SITES_BUILD_KILL_AFTER, 10_000);

console.log(`Running bounded vinext build (timeout ${timeoutMs}ms)...`);

// On Windows the vinext entry is a `.cmd` shim, which requires a shell. Quote
// the path because this checkout lives under a directory that contains spaces.
const isWindows = process.platform === "win32";
const command = isWindows ? `"${vinextBin}"` : vinextBin;

const child = spawn(command, ["build"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: isWindows,
  env: { ...process.env },
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`vinext build exceeded ${timeoutMs}ms; terminating.`);
  child.kill(isWindows ? undefined : "SIGTERM");
  setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, killAfterMs).unref();
}, timeoutMs);

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(`Failed to start vinext build: ${error.message}`);
  process.exit(69);
});

child.on("close", (code, signal) => {
  clearTimeout(timer);

  if (timedOut) {
    console.error("Build timed out and was not retried.");
    process.exit(124);
  }
  if (code !== 0) {
    console.error(`vinext build failed (code=${code} signal=${signal ?? "none"}).`);
    process.exit(code ?? 1);
  }

  // Re-run the validator in-process so its exit code propagates directly.
  const validator = resolve(projectRoot, "scripts", "validate-artifact.mjs");
  const validation = spawn(process.execPath, [validator], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  validation.on("close", (validationCode) => process.exit(validationCode ?? 1));
});
