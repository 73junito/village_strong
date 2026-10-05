/**
 * Runs one submission through the pipeline and prints the report.
 *
 * The point of this script is that the CLI and the durable workflow execute the
 * exact same gate code from `pipeline.ts`, so a run shown here is what the
 * workflow will decide. It is the fastest way to see why a release was held.
 *
 * Note what this script CANNOT do: approve anything. The CLI has no approval
 * path, which is intentional. A clean run stops at AWAITING_APPROVAL here just
 * as it does in the workflow, because releasing is a human decision made against
 * a hashed record through the authenticated API.
 *
 *   node scripts/review.ts fixtures/clean.json
 */
import { readFile } from "node:fs/promises";

import { runPipeline } from "../src/pipeline.ts";
import type { Submission } from "../src/types.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node --experimental-strip-types scripts/review.ts <submission.json>");
  process.exit(64);
}

const submission = JSON.parse(await readFile(path, "utf8")) as Submission;
const { report } = runPipeline(submission, new Date());

const MARK: Record<string, string> = { blocker: "BLOCKER", warning: "warn", info: "info" };

console.log(`course: ${report.submissionCourseId}`);
console.log(`gates:  ${report.completedStages.length} executed`);
console.log("");

for (const [index, result] of report.results.entries()) {
  const status = result.passed ? "PASS" : "HOLD";
  console.log(`${String(index + 1).padStart(2)}. ${status}  ${result.agent}`);
  for (const finding of result.findings) {
    const subject = finding.subject ? ` [${finding.subject}]` : "";
    console.log(`      ${MARK[finding.severity] ?? finding.severity} ${finding.code}${subject}`);
    console.log(`      ${finding.message}`);
  }
}

console.log("");
console.log(
  report.decision === "AWAITING_APPROVAL"
    ? "AWAITING_APPROVAL — all ten agents cleared. A named human approval is required before release."
    : `HELD at gate ${report.haltedAt} (${report.totalBlockers} blocker(s), ${report.totalWarnings} warning(s))`,
);

// Only a held run is a failure of this command. A clean run exits 0 because the
// pipeline behaved correctly by stopping short of a release.
process.exit(report.decision === "HELD" ? 1 : 0);