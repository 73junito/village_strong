/**
 * Domain types for the Village Strong content release pipeline.
 *
 * This module is deliberately free of any Workers, Durable Object or SDK import so
 * the pipeline can be exercised by `node --test` without a Workers runtime. The
 * durable runtime in `workflow.ts` is a thin wrapper over these pure contracts.
 */

/**
 * A finding is one agent's objection to the release candidate.
 *
 * `blocker` halts the pipeline at the current stage: later stages must not run on
 * content whose earlier gate failed, because each stage assumes the artifacts the
 * previous one produced are trustworthy.
 */
export type Severity = "blocker" | "warning" | "info";

export interface Finding {
  /** Stable machine-readable code, e.g. `EVIDENCE-001`. Never reused. */
  code: string;
  severity: Severity;
  message: string;
  /** Optional pointer to the offending item, objective or source id. */
  subject?: string;
}

/** Ordered pipeline stage identifiers. The order here IS the gate order. */
export type StageId =
  | "evidence"
  | "rights"
  | "curriculum"
  | "question"
  | "technical-review"
  | "instructional-review"
  | "assessment-governance"
  | "software-engineering"
  | "validation"
  | "release";

/** An agent stage: pure, synchronous, no I/O. */
export interface StageResult {
  stage: StageId;
  /** The agent's human-facing title, carried into the audit record. */
  agent: string;
  /** `false` when at least one blocker was raised. */
  passed: boolean;
  findings: Finding[];
  /** Numeric counts the gate computed, carried forward for the release record. */
  metrics: Record<string, number>;
}

/**
 * The artifact a stage adds to the shared submission state. Downstream agents
 * read only what earlier stages appended, which is what makes the gate order
 * load-bearing rather than cosmetic.
 */
export interface Submission {
  /** Course or program the release candidate belongs to. */
  courseId: string;
  /** Claims and research the curriculum rests on. */
  sources: Source[];
  /** Third-party or original media plus its licence/consent posture. */
  assets: Asset[];
  /** Learning objectives, the contract the questions must measure. */
  objectives: Objective[];
  /** Question bank items under review. */
  items: Item[];
  /** Free-form notes from previous review rounds. */
  priorReviewNotes: string[];
  /** Artifacts appended by each completed stage, keyed by stage id. */
  stageArtifacts: Partial<Record<StageId, Record<string, unknown>>>;
}

export interface Source {
  id: string;
  title: string;
  /** Publication or study year; used by the evidence agent for currency. */
  year: number;
  /** Whether the source is peer-reviewed or otherwise refereed. */
  peerReviewed: boolean;
  /** Objective ids this source supports. Empty means an orphan citation. */
  supports: string[];
}

export type AssetKind = "image" | "video" | "audio" | "text" | "h5p";

export interface Asset {
  id: string;
  kind: AssetKind;
  title: string;
  /** Free-text licence, e.g. "CC BY 4.0" or "owned". */
  license: string;
  /**
   * Whether the asset shows identifiable people.
   *
   * This is an explicit field rather than an inference from `kind` because the
   * two are independent: an image may be a logo or a banner that shows nobody,
   * and an audio clip may record a person's voice. Treating every image as
   * depicting people would either block the banner or force the author to lie
   * about the asset to get it through.
   */
  depictsPeople: boolean;
  /** Written model/consent release on file, required when `depictsPeople`. */
  consentOnFile: boolean;
  /** Whether the asset is original work or third-party licensed. */
  original: boolean;
}

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export interface Objective {
  id: string;
  text: string;
  /** Intended cognitive level, checked against the question bank later. */
  bloomLevel: BloomLevel;
}

export type ItemKind = "mcq" | "numeric" | "msq" | "constructed";

export interface Item {
  id: string;
  kind: ItemKind;
  /** Objective this item claims to measure. */
  objectiveId: string;
  points: number;
  /** Present for mcq/msq: the option ids. */
  optionIds?: string[];
  /** The option id(s) that are correct. */
  correctOptionIds?: string[];
  /** Present for numeric: accepted answer. */
  numericAnswer?: number;
  /** Present for numeric: accepted absolute tolerance. */
  tolerance?: number;
  /** Answer key/rubric note shown to mentors. */
  rationale?: string;
  /** For constructed-response items: the rubric, if one exists. */
  rubric?: string;
}

/**
 * Terminal state of a release candidate.
 *
 * `RELEASED` is reachable only by an accepted human approval. A run whose ten
 * agents all cleared reaches `AWAITING_APPROVAL` and stops; no amount of
 * automation can move it further. `HELD` is terminal and unapprovable.
 */
export type ReleaseDecision = "HELD" | "AWAITING_APPROVAL" | "RELEASED";

/**
 * A human release approval.
 *
 * Every field is required and every field is verified before it can release
 * anything. `requestHash` is what binds the approval to the exact artifacts the
 * ten agents reviewed; without it an approval for one run could be replayed
 * against a modified submission.
 */
export interface ApprovalRecord {
  /** The workflow instance this approval is for. */
  runId: string;
  /** The human accountable for the decision. */
  approvedBy: string;
  /** Why they approved it. */
  reason: string;
  /** ISO-8601, supplied by the approver and preserved verbatim on replay. */
  approvedAt: string;
  /** SHA-256 of the reviewed submission and gate artifacts. */
  requestHash: string;
}

/**
 * What the workflow asks a human to approve.
 *
 * This is a snapshot of the decision at the moment the pipeline paused, so the
 * approver sees the course, the gate results and the hash they are authorising.
 */
export interface PendingApproval {
  runId: string;
  courseId: string;
  requestHash: string;
  /** When the Release Agent reached its verdict. */
  decidedAt: string;
  completedStages: StageId[];
  totalBlockers: number;
  totalWarnings: number;
  /** Optional note from the submitter explaining why approval is being sought. */
  approvalReason?: string;
}

/** Why an approval was refused. Every value means the run does not release. */
export type ApprovalRejection =
  | "NOT_APPROVABLE"
  | "MALFORMED"
  | "RUN_ID_MISMATCH"
  | "REQUEST_HASH_MISMATCH"
  | "MISSING_ACTOR"
  | "MISSING_REASON"
  | "INVALID_TIMESTAMP";

/**
 * Result of verifying an approval.
 *
 * `duplicate` distinguishes a repeated approval of an already-released run from
 * a fresh one. It is not an error: replaying the same approval must be a no-op,
 * not a second release and not a failure.
 */
export type ApprovalOutcome =
  | { ok: true; duplicate: boolean; decision: "RELEASED"; approval: ApprovalRecord }
  | { ok: false; reason: ApprovalRejection; message: string };

/** Terminal summary of a full run. */
export interface RunReport {
  submissionCourseId: string;
  decision: ReleaseDecision;
  /** Stages that actually executed, in order. */
  completedStages: StageId[];
  /** The stage that halted the run, if any. */
  haltedAt?: StageId;
  results: StageResult[];
  totalBlockers: number;
  totalWarnings: number;
  startedAt: string;
  finishedAt: string;
  /** Present once an approval has been accepted. Never present otherwise. */
  approval?: ApprovalRecord;
}