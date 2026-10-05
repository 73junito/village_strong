/**
 * Agents 1-2: admissibility.
 *
 * Evidence and Rights decide whether the submission may be assessed at all.
 * Both run before any pedagogical judgement, because a question bank built on
 * an unsourced objective or an unlicensed photograph is not repairable by
 * editing the questions later.
 */
import { FindingLog, pass, publish } from "../checks.ts";
import type { StageResult, Submission } from "../types.ts";

/** Sources older than this are flagged as needing a currency justification. */
const STALE_SOURCE_YEARS = 10;

export function evidenceAgent(submission: Submission, now: Date): StageResult {
  const log = new FindingLog();

  if (submission.sources.length === 0) {
    log.blocker(
      "EVIDENCE-001",
      "No sources supplied. Every objective must rest on at least one cited source.",
    );
  }

  const knownObjectiveIds = new Set(submission.objectives.map((o) => o.id));
  const citedObjectiveIds = new Set<string>();
  const seenSourceIds = new Set<string>();
  let peerReviewed = 0;
  let stale = 0;

  for (const source of submission.sources) {
    if (seenSourceIds.has(source.id)) {
      log.blocker("EVIDENCE-002", `Duplicate source id "${source.id}".`, source.id);
    }
    seenSourceIds.add(source.id);

    if (source.supports.length === 0) {
      log.warn(
        "EVIDENCE-003",
        `Source "${source.id}" supports no objective and is an orphan citation.`,
        source.id,
      );
    }

    for (const objectiveId of source.supports) {
      citedObjectiveIds.add(objectiveId);
      if (!knownObjectiveIds.has(objectiveId)) {
        log.blocker(
          "EVIDENCE-004",
          `Source "${source.id}" supports unknown objective "${objectiveId}".`,
          objectiveId,
        );
      }
    }

    if (source.peerReviewed) peerReviewed += 1;

    const age = now.getFullYear() - source.year;
    if (age > STALE_SOURCE_YEARS) {
      stale += 1;
      log.warn(
        "EVIDENCE-005",
        `Source "${source.id}" is ${age} years old; confirm it still reflects current practice.`,
        source.id,
      );
    }
  }

  // The load-bearing check: an uncited objective would otherwise sail through
  // every later stage, because each of those only measures internal coherence.
  const uncited = submission.objectives
    .map((o) => o.id)
    .filter((id) => !citedObjectiveIds.has(id));
  for (const id of uncited) {
    log.blocker(
      "EVIDENCE-006",
      `Objective "${id}" has no supporting source and cannot be assessed defensibly.`,
      id,
    );
  }

  publish(submission, "evidence", {
    admissible: log.count("blocker") === 0,
    peerReviewed,
    stale,
    uncitedObjectives: uncited.length,
  });

  return pass("evidence", "Evidence Agent", log.findings, {
    sources: submission.sources.length,
    peerReviewed,
    staleSources: stale,
    citedObjectives: citedObjectiveIds.size,
    uncitedObjectives: uncited.length,
  });
}

export function rightsAgent(submission: Submission): StageResult {
  const log = new FindingLog();

  if (submission.assets.length === 0) {
    log.warn("RIGHTS-001", "No assets declared. Confirm this release genuinely has no media.");
  }

  const seenAssetIds = new Set<string>();
  let cleared = 0;
  let licensed = 0;

  for (const asset of submission.assets) {
    if (seenAssetIds.has(asset.id)) {
      log.blocker("RIGHTS-002", `Duplicate asset id "${asset.id}".`, asset.id);
    }
    seenAssetIds.add(asset.id);

    if (!asset.license.trim()) {
      log.blocker(
        "RIGHTS-003",
        `Asset "${asset.id}" (${asset.title}) declares no licence.`,
        asset.id,
      );
    } else if (!/^(cc[\s-]|owned|public\s*domain|permission|licensed)/i.test(asset.license)) {
      // Unrecognised licence strings cannot be auto-cleared, only re-checked.
      log.warn(
        "RIGHTS-004",
        `Asset "${asset.id}" licence "${asset.license}" is not a recognised form; needs manual review.`,
        asset.id,
      );
    }

    // A consent obligation attaches to people being shown, not to the file
    // format, so it is keyed off the explicit flag rather than `kind`.
    if (asset.depictsPeople && !asset.consentOnFile) {
      log.blocker(
        "RIGHTS-005",
        `Asset "${asset.id}" depicts people but has no consent release on file.`,
        asset.id,
      );
    }

    if (asset.original) {
      cleared += 1;
    } else {
      licensed += 1;
    }
  }

  publish(submission, "rights", {
    cleared: log.count("blocker") === 0,
    originalAssets: cleared,
    licensedAssets: licensed,
  });

  return pass("rights", "Rights Agent", log.findings, {
    assets: submission.assets.length,
    originalAssets: cleared,
    licensedAssets: licensed,
  });
}