begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_schema('research', 'research schema exists');

select has_table('research', 'studies', 'studies exists');
select has_table('research', 'protocol_versions', 'protocol_versions exists');
select has_table('research', 'instrument_versions', 'instrument_versions exists');
select has_table('research', 'instrument_items', 'instrument_items exists');
select has_table('research', 'participants', 'participants exists');
select has_table('research', 'consent_records', 'consent_records exists');
select has_table('research', 'assessment_administrations', 'assessment_administrations exists');
select has_table('research', 'item_responses', 'item_responses exists');
select has_table('research', 'retention_rules', 'retention_rules exists');
select has_table('research', 'audit_events', 'audit_events exists');

select ok(relrowsecurity, format('%I has RLS enabled', relname))
from pg_class
where oid in (
  'research.studies'::regclass,
  'research.protocol_versions'::regclass,
  'research.instrument_versions'::regclass,
  'research.instrument_items'::regclass,
  'research.participants'::regclass,
  'research.consent_records'::regclass,
  'research.assessment_administrations'::regclass,
  'research.item_responses'::regclass,
  'research.retention_rules'::regclass,
  'research.audit_events'::regclass
)
order by relname;

select ok(relforcerowsecurity, format('%I forces RLS', relname))
from pg_class
where oid in (
  'research.studies'::regclass,
  'research.protocol_versions'::regclass,
  'research.instrument_versions'::regclass,
  'research.instrument_items'::regclass,
  'research.participants'::regclass,
  'research.consent_records'::regclass,
  'research.assessment_administrations'::regclass,
  'research.item_responses'::regclass,
  'research.retention_rules'::regclass,
  'research.audit_events'::regclass
)
order by relname;

select is(
  (select count(*)::integer from pg_policies where schemaname = 'research'),
  0,
  'no research RLS policies exist before the access model is approved'
);

select ok(
  not has_schema_privilege('anon', 'research', 'USAGE'),
  'anon has no usage on research schema'
);

select ok(
  not has_schema_privilege('authenticated', 'research', 'USAGE'),
  'authenticated has no usage on research schema'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'research'
      and grantee in ('anon', 'authenticated')
  ),
  'anon and authenticated have no research table grants'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'research'
      and column_name in (
        'name', 'first_name', 'last_name', 'email', 'phone', 'address',
        'date_of_birth', 'signature', 'ssn'
      )
  ),
  'research schema contains no direct-identifier columns'
);

select * from finish();
rollback;
