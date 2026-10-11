-- Review-only research data foundation.
--
-- This migration intentionally creates no public policies, seed participants,
-- collection endpoint, or browser grant. It must not be applied to a live
-- project until the study protocol, consent materials, retention schedule,
-- access roles, and ethics review have been approved.

create schema if not exists research;

comment on schema research is
  'Private, de-identified research records. Not exposed to anon or authenticated clients.';

revoke all on schema research from public;
revoke all on schema research from anon, authenticated;

create table research.studies (
  id uuid primary key default gen_random_uuid(),
  study_code text not null unique check (study_code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  title text not null check (length(btrim(title)) between 3 and 240),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'active', 'paused', 'closed', 'archived')),
  purpose text not null check (length(btrim(purpose)) >= 20),
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved', 'active', 'paused', 'closed', 'archived') or approved_at is not null),
  check (status not in ('closed', 'archived') or closed_at is not null)
);

create table research.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references research.studies(id) on delete restrict,
  version text not null check (length(btrim(version)) between 1 and 40),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'retired')),
  effective_at timestamptz,
  consent_summary text not null,
  privacy_summary text not null,
  retention_summary text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (study_id, version),
  check (status not in ('approved', 'retired') or (approved_by is not null and approved_at is not null))
);

create table research.instrument_versions (
  id uuid primary key default gen_random_uuid(),
  instrument_code text not null check (instrument_code in ('FRI', 'PPARS', 'EFAS')),
  version text not null check (length(btrim(version)) between 1 and 40),
  development_stage text not null default 'draft'
    check (development_stage in (
      'draft', 'expert_review', 'cognitive_interview', 'pilot',
      'exploratory_validation', 'confirmatory_validation', 'retired'
    )),
  scoring_specification jsonb not null default '{}'::jsonb,
  evidence_summary text not null default 'Developmental; not validated for diagnostic or clinical use.',
  created_at timestamptz not null default now(),
  unique (instrument_code, version)
);

create table research.instrument_items (
  id uuid primary key default gen_random_uuid(),
  instrument_version_id uuid not null references research.instrument_versions(id) on delete restrict,
  item_code text not null check (length(btrim(item_code)) between 1 and 40),
  domain_code text not null check (length(btrim(domain_code)) between 1 and 80),
  prompt text not null check (length(btrim(prompt)) >= 3),
  response_specification jsonb not null,
  display_order integer not null check (display_order > 0),
  reverse_scored boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (instrument_version_id, item_code),
  unique (instrument_version_id, display_order)
);

create table research.participants (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references research.studies(id) on delete restrict,
  participant_code text not null check (participant_code ~ '^[A-Z0-9][A-Z0-9_-]{7,63}$'),
  enrollment_status text not null default 'screening'
    check (enrollment_status in ('screening', 'enrolled', 'withdrawn', 'completed', 'excluded')),
  enrolled_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique (study_id, participant_code),
  check (enrollment_status <> 'enrolled' or enrolled_at is not null),
  check (enrollment_status <> 'withdrawn' or withdrawn_at is not null)
);

comment on table research.participants is
  'Pseudonymous research codes only. Direct identifiers belong in a separately approved system, never this table.';

create table research.consent_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references research.participants(id) on delete restrict,
  protocol_version_id uuid not null references research.protocol_versions(id) on delete restrict,
  consent_scope text[] not null check (cardinality(consent_scope) > 0),
  consented_at timestamptz not null,
  consent_method text not null check (consent_method in ('written', 'electronic', 'verbal_documented')),
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  unique (participant_id, protocol_version_id),
  check (withdrawn_at is null or withdrawn_at >= consented_at)
);

comment on table research.consent_records is
  'Consent facts and scope only; do not store signatures, identity documents, or raw consent files here.';

create table research.assessment_administrations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references research.participants(id) on delete restrict,
  protocol_version_id uuid not null references research.protocol_versions(id) on delete restrict,
  instrument_version_id uuid not null references research.instrument_versions(id) on delete restrict,
  administration_code text not null check (length(btrim(administration_code)) between 3 and 80),
  status text not null default 'started'
    check (status in ('started', 'completed', 'withdrawn', 'invalidated')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  invalidation_reason text,
  created_at timestamptz not null default now(),
  unique (participant_id, administration_code),
  check (status <> 'completed' or completed_at is not null)
);

create table research.item_responses (
  id uuid primary key default gen_random_uuid(),
  administration_id uuid not null references research.assessment_administrations(id) on delete restrict,
  instrument_item_id uuid not null references research.instrument_items(id) on delete restrict,
  response_number numeric,
  response_text text,
  response_data jsonb,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (administration_id, instrument_item_id),
  check (num_nonnulls(response_number, response_text, response_data) = 1)
);

create table research.retention_rules (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references research.studies(id) on delete restrict,
  record_class text not null check (record_class in (
    'participant', 'consent', 'administration', 'response', 'audit'
  )),
  retention_days integer not null check (retention_days > 0),
  disposition text not null check (disposition in ('delete', 'deidentify', 'archive')),
  legal_basis text not null check (length(btrim(legal_basis)) >= 10),
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (study_id, record_class)
);

create table research.audit_events (
  id bigint generated always as identity primary key,
  study_id uuid references research.studies(id) on delete restrict,
  actor_id uuid,
  action text not null check (length(btrim(action)) between 3 and 100),
  entity_type text not null check (length(btrim(entity_type)) between 3 and 80),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index protocol_versions_study_idx on research.protocol_versions(study_id);
create index instrument_items_version_idx on research.instrument_items(instrument_version_id);
create index participants_study_idx on research.participants(study_id);
create index consent_records_participant_idx on research.consent_records(participant_id);
create index administrations_participant_idx on research.assessment_administrations(participant_id);
create index item_responses_administration_idx on research.item_responses(administration_id);
create index audit_events_study_time_idx on research.audit_events(study_id, occurred_at desc);

alter table research.studies enable row level security;
alter table research.protocol_versions enable row level security;
alter table research.instrument_versions enable row level security;
alter table research.instrument_items enable row level security;
alter table research.participants enable row level security;
alter table research.consent_records enable row level security;
alter table research.assessment_administrations enable row level security;
alter table research.item_responses enable row level security;
alter table research.retention_rules enable row level security;
alter table research.audit_events enable row level security;

alter table research.studies force row level security;
alter table research.protocol_versions force row level security;
alter table research.instrument_versions force row level security;
alter table research.instrument_items force row level security;
alter table research.participants force row level security;
alter table research.consent_records force row level security;
alter table research.assessment_administrations force row level security;
alter table research.item_responses force row level security;
alter table research.retention_rules force row level security;
alter table research.audit_events force row level security;

revoke all on all tables in schema research from public, anon, authenticated;
revoke all on all sequences in schema research from public, anon, authenticated;

alter default privileges in schema research revoke all on tables from public, anon, authenticated;
alter default privileges in schema research revoke all on sequences from public, anon, authenticated;

comment on table research.item_responses is
  'De-identified research responses. No public policy exists; collection remains disabled.';
