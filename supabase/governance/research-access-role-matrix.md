# Research access-role matrix

**Status:** Draft — no role below grants access until named assignments, RLS
policies, staging tests, and final approval exist.

Authorization must use controlled server-side identity or trustworthy
`app_metadata`; never use user-editable `user_metadata` for an access decision.
The Supabase secret key or legacy `service_role` key is an application secret,
not a human role and not a substitute for individual accountability.

## Proposed least-privilege matrix

| Capability | Investigator | Study administrator | Consent custodian | Data analyst | Security auditor | System service |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Approve protocol/version | A | — | — | — | — | — |
| Create pseudonymous participant code | — | A | — | — | — | Limited |
| View direct identifiers | — | — | Separate system only | — | — | — |
| Record consent fact/scope | Read | — | A | — | Audit only | Limited |
| Administer approved instrument | Read | A | — | — | — | Limited |
| View item responses | Read | Limited | — | De-identified only | Audit only | Limited |
| Export de-identified dataset | Approve | — | — | A | Audit only | Limited |
| Change retention rule | Approve | — | — | — | Review | — |
| Execute approved deletion | Approve | — | Verify | — | Audit | Limited |
| Read audit events | Read | — | — | — | A | Append only |
| Change RLS or credentials | — | — | — | — | Review | Named admin only |

Legend: `A` = accountable/authorized after approval; `Limited` = only the
minimum rows/operations required by the approved workflow; `—` = denied.

## Named assignment record

| Person/service | Role | Study scope | Start | End/review | Approver | Evidence |
|---|---|---|---|---|---|---|
| _None assigned_ | — | — | — | — | — | — |

## Mandatory controls

- Unique human accounts; no shared reviewer or administrator credentials.
- Multi-factor authentication for privileged accounts.
- Server-side secret storage and rotation; no secret key in browser code.
- RLS policies must name roles and enforce study/row scope. `TO authenticated`
  alone is authentication, not authorization.
- UPDATE policies require both `USING` and `WITH CHECK`; SELECT access must be
  tested because UPDATE also requires visibility of the row.
- Time-limited assignments, prompt removal, session revocation, and periodic
  access review.
- Audit exports, role changes, protocol changes, consent changes, deletion, and
  security events.

## Test gate

Before approval, database tests must prove allowed and denied SELECT, INSERT,
UPDATE, and DELETE behavior for every role and record class, including
cross-study access, withdrawn participants, expired roles, and anonymous users.
