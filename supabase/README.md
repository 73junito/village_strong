# Supabase research foundation

This directory contains a **review-only** database foundation for future FRI,
PPARS, and EFAS research. It does not connect the public website to Supabase,
apply a migration, create participants, or enable data collection.

## Current safety posture

- Research data lives in a private `research` schema, not `public`.
- Every table has row-level security enabled and forced.
- `public`, `anon`, and `authenticated` receive no schema, table, or sequence
  privileges.
- There are no RLS policies, browser grants, seed participants, API routes, or
  Supabase client dependency.
- Direct identifiers, signatures, identity documents, and raw consent files are
  explicitly outside this schema.
- Instrument versions remain developmental and may not be represented as
  validated, diagnostic, or clinical instruments.

## Approval gate before any live application

Do not run `supabase db push`, paste this migration into the SQL editor, or add
Supabase credentials to the web application until all of the following are
approved and documented:

1. Final study protocol and named accountable investigator.
2. Ethics/IRB determination appropriate to the proposed activity.
3. Informed-consent and withdrawal materials.
4. Data minimization, de-identification, retention, deletion, and incident plan.
5. A role matrix identifying who may administer studies, view consent, analyze
   de-identified responses, and audit activity.
6. A separate design for any direct identifiers; they must not be added to the
   response schema.
7. RLS policies and database tests for the approved access model.
8. A staging application and security review; never begin with the public site.

## Review commands (future staging environment only)

Use the Supabase CLI help for the installed version rather than assuming flags:

```sh
supabase --version
supabase migration list --local
supabase test db
supabase db advisors
```

The SQL tests in `tests/research_schema_security.sql` are intentionally written
to fail if RLS is disabled, a public policy appears, or `anon`/`authenticated`
receive privileges. They require a local Supabase database containing the
migration and pgTAP.

## Secrets

The project URL is an identifier, not a secret. Publishable keys may eventually
be used in a browser only after an approved RLS design exists. Supabase secret
keys and legacy `service_role` keys must remain in a server-side secret store;
they must never be committed, placed in `NEXT_PUBLIC_*`, pasted into issues, or
embedded in client code.
