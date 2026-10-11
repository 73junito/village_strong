# Data retention, deletion, and incident-response plan

**Status:** Draft — durations and legal bases are intentionally unapproved.  
**Study code:**  
**Protocol version:**  
**Plan version:**  
**Owner:**  
**Approved by/date:**

## Principles

Collect the minimum data required by the approved protocol; separate consent
from responses; keep direct identifiers outside the research schema; restrict
access by role; document exports; and delete or de-identify records when the
approved retention period ends.

## Record schedule

Do not insert a `retention_rules` row until every field below is approved.

| Record class | Examples | Retention period | Start event | Disposition | Legal/ethical basis | Owner |
|---|---|---:|---|---|---|---|
| Participant | Pseudonymous code/status | TBD | TBD | Delete/de-identify/archive | TBD | TBD |
| Consent | Version, scope, time, withdrawal | TBD | TBD | TBD | TBD | TBD |
| Administration | Instrument/protocol instance | TBD | TBD | TBD | TBD | TBD |
| Response | Item-level response | TBD | TBD | TBD | TBD | TBD |
| Audit | Security and access event | TBD | TBD | TBD | TBD | TBD |

## Data locations and copies

Inventory the database, backups, exports, analyst files, logs, consent records,
identity-linkage records, local devices, cloud storage, and third-party systems.
For each, name the owner, encryption, access control, backup behavior, and
deletion mechanism. Supabase database backups do not automatically account for
separately stored files or downstream exports.

## Deletion and de-identification procedure

1. Validate authority and scope of the request or scheduled disposition.
2. Pause new processing if necessary.
3. Identify the participant code and every approved copy without placing direct
   identifiers into the research schema.
4. Apply the protocol's rule for withdrawal and previously collected data.
5. Delete, de-identify, or archive each copy as authorized.
6. Account for backups and document when expiry makes deletion effective.
7. Record the action and reviewer in the audit trail without reproducing the
   deleted sensitive content.
8. Notify the participant when promised by the approved consent materials.

## Security incident response

1. Contain access and preserve necessary evidence.
2. Revoke affected sessions/credentials; deleting a user alone does not
   invalidate existing access tokens.
3. Identify affected record classes, people, jurisdictions, and time window.
4. Notify the accountable investigator, privacy lead, ethics/IRB reviewer, and
   legal counsel according to the approved escalation matrix.
5. Determine required participant or regulator notifications and deadlines.
6. Remediate, verify, document lessons learned, and obtain approval before
   resuming collection.

## Review triggers

Review this plan when the protocol, instrument, population, jurisdiction,
vendor, storage location, access role, purpose, consent, or applicable rule
changes, and at least annually while records remain.
