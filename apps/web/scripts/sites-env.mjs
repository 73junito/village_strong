#!/usr/bin/env node
/**
 * Cross-platform replacement for scripts/sites-env.sh.
 *
 * Creates a disposable, project-local runtime tree and points HOME, npm cache,
 * XDG config, temp, and Wrangler/Miniflare state at it so local builds never
 * touch the developer's real home directory. Callers may override any of these
 * by exporting the variable before invoking this script.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = process.env.SITES_RUNTIME_ROOT
  ? resolve(process.env.SITES_RUNTIME_ROOT)
  : resolve(projectRoot, ".sites-runtime");

const runtimePath = (...segments) => join(runtimeRoot, ...segments);

for (const dir of ["home", "npm-cache", "xdg-config", "tmp", "wrangler", "wrangler/logs"]) {
  mkdirSync(runtimePath(...dir.split("/")), { recursive: true });
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/sites-env.mjs <command> [args...]");
  process.exit(64);
}

const env = {
  ...process.env,
  SITES_ENV_READY: "1",
  SITES_PROJECT_ROOT: projectRoot,
  HOME: runtimePath("home"),
  XDG_CONFIG_HOME: runtimePath("xdg-config"),
  TMPDIR: runtimePath("tmp"),
  WRANGLER_WRITE_LOGS: process.env.WRANGLER_WRITE_LOGS ?? "false",
  WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? runtimePath("wrangler", "logs"),
  MINIFLARE_REGISTRY_PATH:
    process.env.MINIFLARE_REGISTRY_PATH ?? runtimePath("wrangler", "registry"),
  npm_config_cache: runtimePath("npm-cache"),
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

// npm-specific proxy aliases make npm 11 reinterpret or warn about the
// standard HTTP(S)_PROXY variables, so drop them when the caller did not set them.
for (const key of [
  "npm_config_proxy",
  "npm_config_http_proxy",
  "npm_config_https_proxy",
  "NPM_CONFIG_PROXY",
  "NPM_CONFIG_HTTP_PROXY",
  "NPM_CONFIG_HTTPS_PROXY",
]) {
  if (process.env[key] === undefined) delete env[key];
}

// Windows needs a shell to run `.cmd` shims (wrangler, vinext, eslint), and a
// shell re-parses the command line, so quote every part. This checkout lives
// under a directory that contains spaces.
const isWindows = process.platform === "win32";
const result = isWindows
  ? spawnSync([command, ...args].map((part) => `"${part}"`).join(" "), {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      shell: true,
    })
  : spawnSync(command, args, { cwd: projectRoot, env, stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(70);
}
process.exit(result.status ?? 1);
