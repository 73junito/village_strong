/**
 * Runs the advisory policy and claim checker over one submission and prints the
 * JSON report.
 *
 * This is the policy counterpart to `review.ts`, but it is deliberately
 * advisory: it never touches the release pipeline, approves nothing, and its
 * output is a standalone `PolicyCheckReport` for a reviewer to inspect. The
 * checker's blocker findings are inputs to a *separately reviewed* policy gate,
 * not a release verdict, which is why this script exits 0 whenever a report is
 * produced regardless of what it found.
 *
 * Because the report must be reproducible, the clock is injected rather than
 * read: pass `--now <ISO-8601>` to pin it, or omit it for a fixed default. Two
 * runs with the same inputs and the same `--now` produce byte-identical output.
 *
 *   node --experimental-strip-types scripts/policy-check.ts <submission.json> \
 *     [--content <text-file>] [--link-checks <checks.json>] [--now <ISO-8601>]
 *
 * `--content` supplies public-site text to scan; it is read from a file, never
 * fetched. `--link-checks` supplies offline link-check results or an approved
 * route manifest (see `OfflineLinkCheck`); no network validation is performed.
 */
import { readFile } from "node:fs/promises";

import { runPolicyCheck } from "../src/agents/policy-check.ts";
import type { OfflineLinkCheck } from "../src/agents/policy-links.ts";
import type { Submission } from "../src/types.ts";

/** A fixed default clock, so an unparameterised run is still reproducible. */
const DEFAULT_NOW = "2026-10-11T00:00:00.000Z";

interface Args {
  submissionPath?: string;
  contentPath?: string;
  linkChecksPath?: string;
  now: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { now: DEFAULT_NOW };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--content":
        args.contentPath = value;
        i += 1;
        break;
      case "--link-checks":
        args.linkChecksPath = value;
        i += 1;
        break;
      case "--now":
        args.now = value ?? DEFAULT_NOW;
        i += 1;
        break;
      default:
        if (!flag?.startsWith("--") && args.submissionPath === undefined) {
          args.submissionPath = flag;
        }
        break;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.submissionPath) {
  console.error(
    "Usage: node --experimental-strip-types scripts/policy-check.ts <submission.json> " +
      "[--content <text-file>] [--link-checks <checks.json>] [--now <ISO-8601>]",
  );
  process.exit(64);
}

const now = new Date(args.now);
if (Number.isNaN(now.getTime())) {
  console.error(`Invalid --now value: ${args.now}`);
  process.exit(64);
}

const submission = JSON.parse(await readFile(args.submissionPath, "utf8")) as Submission;

const options: Parameters<typeof runPolicyCheck>[2] = {};
if (args.contentPath) options.content = await readFile(args.contentPath, "utf8");
if (args.linkChecksPath) {
  options.linkChecks = JSON.parse(await readFile(args.linkChecksPath, "utf8")) as OfflineLinkCheck[];
}

const report = runPolicyCheck(submission, now, options);

// A single JSON document so the artifact diffs cleanly in review.
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

// Advisory: producing a report is success even when blockers were found. A
// non-zero exit here would imply a release decision this checker cannot make.
process.exit(0);
