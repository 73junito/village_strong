# Research governance approval package

**Status:** Draft templates only — not an approved protocol, consent form, IRB
determination, authorization to recruit, or authorization to collect data.

These documents are the governance prerequisites for the review-only Supabase
schema in `supabase/migrations/20261011194123_create_research_foundation.sql`.
Completing a template does not activate the schema or permit research activity.

## Required sequence

1. Name the accountable investigator and complete the study protocol.
2. Obtain a written ethics/IRB determination from a qualified reviewer or
   institution. Village Strong Foundation must not self-label a project
   “exempt” without the documented process required by the reviewing body.
3. Finalize the consent and withdrawal materials identified in that
   determination.
4. Approve the data-retention, deletion, and incident-response plan.
5. Assign named people to the access-role matrix using least privilege.
6. Create RLS policies for the approved access model and prove them with
   database tests in an isolated staging project.
7. Complete a security review and documented go/no-go decision.
8. Only after all prior gates pass may a separately reviewed change apply the
   migration or connect an application.

## Hard stops

- No recruitment, enrollment, consent, pilot administration, or response
  collection through the public website.
- No collection involving children or adolescents until the ethics reviewer
  has addressed parental permission, assent, age verification, and applicable
  additional protections in writing.
- No names, email addresses, phone numbers, birth dates, addresses,
  signatures, identity documents, health records, or other direct identifiers
  in the `research` schema.
- No Supabase secret key or legacy `service_role` key in Git, browser code,
  screenshots, issues, or chat.
- No claim that FRI, PPARS, or EFAS is validated, diagnostic, or clinical.

## Approval record

All fields must be completed before a future implementation PR may cite this
package as approved.

| Gate | Responsible person/body | Decision | Date | Version/evidence location |
|---|---|---|---|---|
| Study protocol | _Unassigned_ | Pending | — | — |
| Ethics/IRB determination | _Unassigned_ | Pending | — | — |
| Consent and withdrawal | _Unassigned_ | Pending | — | — |
| Retention/deletion/incident plan | _Unassigned_ | Pending | — | — |
| Access-role matrix | _Unassigned_ | Pending | — | — |
| RLS and staging security tests | _Unassigned_ | Pending | — | — |
| Final go/no-go | _Unassigned_ | Pending | — | — |

Templates in this directory are operational aids, not legal advice and not a
substitute for review by qualified research, privacy, and legal professionals.
