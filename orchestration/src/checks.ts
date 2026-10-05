/**
 * Small helpers shared by the ten agents.
 *
 * Agents are pure functions: they take a submission, log findings, and append
 * their own artifact. They never mutate anything outside the submission they are
 * given, which is what lets the durable workflow re-run a single step safely.
 */
import type { Finding, Severity, StageId, StageResult, Submission } from "./types.ts";

/** Accumulates findings for one agent run, keyed by severity. */
export class FindingLog {
  readonly findings: Finding[] = [];

  add(severity: Severity, code: string, message: string, subject?: string): void {
    this.findings.push({ code, severity, message, subject });
  }

  blocker(code: string, message: string, subject?: string): void {
    this.add("blocker", code, message, subject);
  }

  warn(code: string, message: string, subject?: string): void {
    this.add("warning", code, message, subject);
  }

  info(code: string, message: string, subject?: string): void {
    this.add("info", code, message, subject);
  }

  count(severity: Severity): number {
    return this.findings.filter((f) => f.severity === severity).length;
  }
}

/** Builds a stage result, deriving `passed` from the blocker count. */
export function pass(
  stage: StageId,
  agent: string,
  findings: Finding[],
  metrics: Record<string, number> = {},
): StageResult {
  return {
    stage,
    agent,
    passed: findings.every((f) => f.severity !== "blocker"),
    findings,
    metrics,
  };
}

/** Records a stage's artifact so later stages can read it. */
export function publish(
  submission: Submission,
  stage: StageId,
  artifact: Record<string, unknown>,
): void {
  submission.stageArtifacts = {
    ...submission.stageArtifacts,
    [stage]: artifact,
  };
}

/**
 * Reads a value another stage published.
 *
 * Returns undefined when that stage has not run, so callers must treat a missing
 * artifact as "the upstream gate did not clear" rather than as an empty result.
 *
 * The constraint is `object` rather than `Record<string, unknown>` so a stage can
 * publish a typed artifact with a named interface. Those types are all built from
 * plain values, so this loosens the check without weakening the data.
 */
export function readArtifact<T extends object>(
  submission: Submission,
  stage: StageId,
): T | undefined {
  return submission.stageArtifacts[stage] as T | undefined;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}