#!/usr/bin/env node
/**
 * Cross-platform replacement for scripts/install-ci.sh.
 *
 * Performs a single, non-retrying `npm ci` against package-lock.json inside the
 * project-local runtime tree, then confirms the vinext binary is present.
 * A concurrent install for this project is refused rather than queued.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = resolve(process.env.SITES_RUNTIME_ROOT ?? resolve(projectRoot, ".sites-runtime"));
const npmCache = resolve(runtimeRoot, "npm-cache");
const lockFile = resolve(runtimeRoot, "install.lock");
const stampFile = resolve(projectRoot, "node_modules", ".sites-install.json");

mkdirSync(npmCache, { recursive: true });

const vinextBin = resolve(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vinext.cmd" : "vinext",
);

// Serialize installs with an exclusive lock file. A second installer exits
// instead of racing the first one against the same node_modules tree.
let lockHandle;
try {
  lockHandle = openSync(lockFile, "wx");
} catch (error) {
  if (error.code === "EEXIST") {
    console.error(
      `Another dependency install holds ${lockFile}. Remove it if no install is running.`,
    );
    process.exit(75);
  }
  throw error;
}

const releaseLock = () => {
  try {
    rmSync(lockFile, { force: true });
  } finally {
    if (lockHandle !== undefined) {
      try {
        lockHandle.close();
      } catch {
        // The handle may already be closed; the unlink above is what matters.
      }
    }
  }
};

process.on("exit", releaseLock);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    releaseLock();
    process.exit(130);
  });
}

try {
  const lockfilePath = resolve(projectRoot, "package-lock.json");
  if (!existsSync(lockfilePath)) {
    console.error("package-lock.json is missing; cannot run a reproducible install.");
    process.exit(65);
  }
  const lockfileSha256 = createHash("sha256")
    .update(readFileSync(lockfilePath))
    .digest("hex");

  console.log("[sites] running exactly one bounded npm ci");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npmCommand, ["ci", "--cache", npmCache, "--no-audit", "--no-fund"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_cache: npmCache,
        npm_config_audit: "false",
        npm_config_fund: "false",
        NPM_CONFIG_MAXSOCKETS: "1",
        NPM_CONFIG_FETCH_RETRIES: "0",
        NPM_CONFIG_FETCH_TIMEOUT: "30000",
      },
    },
  );

  if (install.status !== 0) {
    console.error(`npm ci failed (code=${install.status}). Not retried.`);
    process.exit(install.status ?? 1);
  }

  if (!existsSync(vinextBin)) {
    console.error("npm ci succeeded but node_modules/.bin/vinext is unavailable.");
    process.exit(69);
  }

  mkdirSync(dirname(stampFile), { recursive: true });
  writeFileSync(
    stampFile,
    `${JSON.stringify(
      {
        lockfileSha256,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("[sites] npm ci passed and vinext is available");
} finally {
  releaseLock();
}
