# Fatherhood Science research-data specification v0.1

**Status:** Draft — no collection or database application authorized  
**Applies to:** FS-INSTRUMENT-DEVELOPMENT protocol v0.1  
**Prepared:** October 11, 2026

## 1. Design objective

Support versioned, de-identified instrument-development records while keeping
identity, consent evidence, research responses, and analysis exports separated.
The current Supabase migration is a review artifact only and remains unapplied.

## 2. Record map

| Record | Purpose | Allowed content | Prohibited content |
|---|---|---|---|
| `studies` | Study identity and lifecycle | Code, title, purpose, status, approval/closure times | Participant data or implied approval without evidence |
| `protocol_versions` | Immutable protocol context | Version, consent/privacy/retention summaries, approval metadata | Raw consent documents or signatures |
| `instrument_versions` | Versioned FRI/PPARS/EFAS definition | Stage, scoring specification, evidence limits | Unsupported validation claims |
| `instrument_items` | Version-specific item bank | Item/domain code, prompt, response specification, order | Direct identifiers |
| `participants` | Pseudonymous study participation | Random participant code and lifecycle status | Name, email, phone, address, birth date, identity document |
| `consent_records` | Consent fact and scope | Protocol version, scope, method, dates, withdrawal | Signature image, identity document, raw consent file |
| `assessment_administrations` | One approved instrument event | Participant, protocol, instrument, status, timestamps | Contact or identity data |
| `item_responses` | One response per item/administration | One numeric, text, or structured response | Contact data, clinical record, free-text identity solicitation |
| `retention_rules` | Approved disposition schedule | Record class, duration, disposition, basis, approval time | Placeholder duration represented as approved |
| `audit_events` | Security and governance trace | Actor identifier, action, entity reference, minimal details | Secret values or copied sensitive content |

## 3. Participant-code requirements

- Generate codes with a cryptographically secure random source.
- Do not derive a code from initials, birth date, email, phone, address, or a
  stable public identifier.
- Do not reuse a code across unrelated studies unless a separately approved
  longitudinal design requires it.
- Keep any identity-to-code linkage outside the research schema, encrypted and
  restricted to the consent custodian.

## 4. Instrument versioning

The workbook v0.3 baseline contains FRI 48 items, PPARS 46 items, and EFAS 41
items at the item-development stage. Importing item text is not authorized by
this specification. A future import must:

1. identify the approved instrument version and source hash;
2. preserve stable item and domain codes;
3. record response options, recall period, scoring direction, and display order;
4. prohibit silent edits after an administration exists;
5. create a new version for substantive wording, response, scoring, or domain
   changes;
6. keep developmental evidence limits visible in every export.

## 5. Consent and withdrawal state

An administration may begin only when the participant is eligible under the
approved protocol and a current, unwithdrawn consent record covers the planned
instrument and activity. A future implementation must enforce this rule on the
server and prove it with database/integration tests.

Withdrawal must stop new interaction immediately. Handling of already
collected data must follow the approved consent and protocol rather than an
invented default. Every withdrawal and disposition action requires an audit
event that does not reproduce sensitive content.

## 6. Access model

No human or browser access exists today. Future access must use unique identities
and approved role assignments. Authorization may rely on controlled
server-side roles or trustworthy `app_metadata`, never user-editable
`user_metadata`.

RLS tests must cover allowed and denied SELECT, INSERT, UPDATE, and DELETE for
each role; cross-study access; anonymous and ordinary authenticated users;
withdrawn participants; expired assignments; protocol/instrument version
mismatch; and exports. An authenticated role without a row/study predicate is
not sufficient authorization.

## 7. Response-quality states

Missing, skipped, not applicable, withdrawn, invalidated, and structurally
unavailable responses must remain distinguishable. Zero, blank, and missing
must not be silently collapsed. Free-text responses require a specific approved
purpose and warning not to enter names or contact details.

## 8. Export and analysis controls

- Export only the fields required for the approved analysis.
- Remove identity-linkage capability and rotate export identifiers when
  appropriate.
- Record requestor, approval, purpose, fields, filters, row count, time,
  destination, retention, and destruction confirmation.
- Keep exploratory and confirmatory datasets separated.
- Preserve protocol, instrument, scoring, code, and data-cleaning versions.
- Do not release small-cell demographic tables that create re-identification
  risk.
- Do not return individual scores as diagnoses or fitness determinations.

## 9. Retention and incident controls

No retention duration is approved. The system must reject activation of an
`active` study until each required record class has a reviewed retention rule.
Deletion must cover operational copies, exports, and backup expiry and must be
auditable without retaining the deleted data itself.

Incident response must include containment, session/credential revocation,
scope assessment, required notification review, remediation, verification, and
approval before collection resumes. Deleting a user account alone is not a
session-revocation strategy.

## 10. Activation gate

| Requirement | Current state |
|---|---|
| Migration applied | No |
| Tables contain data | No |
| Data API access granted | No |
| RLS allow policies approved | No |
| Application client installed | No |
| Secret configured | No |
| Recruitment approved | No |
| Collection approved | No |

The approved future state must be demonstrated in an isolated staging project
before any production decision. Until then, this specification describes the
desired boundary; it does not create access or functionality.
