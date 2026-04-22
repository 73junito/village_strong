DB / Entity Planning — Village Strong (high level)

Entities (tables)
- user (moodle's core user table)
- role (moodle role table)
- cohort
- course
- module/activity
- points_ledger
  - id, user_id, source, points, granted_by, timestamp, reason
- badge_award
  - id, user_id, badge_id, awarded_by, timestamp
- reflection_entry
  - id, user_id, module_id, content (private), mentor_visible, timestamp
- mentor_observation
  - id, mentor_id, user_id, module_id, rubric_scores, notes, timestamp
- certificate_award

Relationships
- user -> cohort: many-to-many (user_cohort)
- cohort -> course: many-to-many (cohort_course)
- user -> points_ledger: one-to-many
- module/activity -> points_ledger: one-to-many
- user -> reflection_entry: one-to-many
- mentor -> mentor_observation: one-to-many

Notes
- Use Moodle core tables where possible; points_ledger and mentor_observation are pilot custom tables or implemented via plugin (Level Up XP, custom feedback forms).
- Ensure all PII is protected and reflection content flagged as private (moodle capability controls).

Export / reporting
- Build reporting views that join core Moodle tables with points_ledger and mentor_observation for program dashboards.
- Avoid including raw reflection content in public exports; use coded themes or anonymized extracts for research reports.
