Village Strong — Moodle Development Architecture (Developer Brief)

Version: 0.1
Author: Prepared for Rafael / Village Strong
Date: 2026-03-13

Purpose
-------
This document is a developer-focused blueprint to implement "Village Strong — The Hero's Path" on Moodle. It translates the program's narrative mentorship model into a technical architecture, deployment guidance, data model, plugin stack, and prioritized deliverables for a pilot.

Summary / Vision
----------------
Build a mission-centered Moodle site that functions as a digital mentorship ecosystem: the Village Strong Digital Academy. The user experience should mirror the Hero's Path narrative and mentor-led facilitation rather than a traditional course catalog.

High-level Architecture
-----------------------
- Presentation Layer: custom Moodle theme, responsive UI, journey/dashboards, Hall of Champions.
- Application Layer: Moodle core + configured plugins (gamification, H5P, badges, certificates, feedback, checklists, custom reports).
- Data Layer: MariaDB/Postgres storing users, cohorts, course progress, badges, points ledger, reflections, mentor notes.
- Integration Layer: Zoom/BigBlueButton, SMTP, SSO options, analytics export (CSV / API), optional Nextcloud.

Core Requirements
-----------------
- Narrative course flow using a 10-week module template (Module 0..10).
- Mentor role (Village Guide) with permissions to award points, submit observations, and moderate cohorts.
- Gamification: Village Strength Points, rank progression (Pathfinder → Champion), leaderboards, badges, and certificates.
- Private reflection journals for participants (mentor visible) and mentor evaluation rubrics.
- Reporting dashboards for youth outcomes and pilot metrics.

Site Taxonomy (Moodle Categories)
---------------------------------
- Youth Programs (Hero's Path courses, cohorts)
- Mentor Academy (Village Guide certification)
- Partner Programs (school/organization cohorts)
- Administration & Reporting (restricted)

Course Template (Hero's Path Master)
------------------------------------
Each course uses the same weekly structure (module template):
1. Opening Reflection (video/quote)
2. Story Scenario (H5P interactive story)
3. Team Discussion (forum / group activity)
4. Decision Activity (branching / quiz)
5. Leadership Lesson (lesson page / downloadable PDF)
6. Journal Reflection (private assignment)
7. Village Strength Points (automatic & manual triggers)

Reusable Curriculum Objects
---------------------------
- `character_sheet` (custom profile / form)
- `weekly_scenario_card` (H5P + instructions)
- `mentor_rubric` (rubric activity)
- `reflection_journal` (private assignment template)
- `points_trigger` (completion rules + manual point form)

Roles & Permissions (custom roles)
---------------------------------
- Village Administrator: full site control
- Program Director: cohort oversight, reporting
- Village Guide: facilitate, award points, mentor observations
- Hero: participant access
- Partner Coordinator: organization-level reporting
- Parent/Guardian Observer: optional limited view

Data Model (Entities & Relationships)
-------------------------------------
Key entities: user, role, organization, cohort, course, module, activity, badge, points_ledger, reflection_entry, mentor_observation, certificate.
Relationships: users→cohorts, cohorts→courses, mentors→cohorts, activities→points/badges.

Points & Badges Design
----------------------
- Points ledger table: timestamp, user_id, source_activity, amount, granted_by, reason.
- Badge triggers: completion, mentor award thresholds, behavioral badges.
- Rank thresholds: define XP ranges for Pathfinder, Guardian, Builder, Leader, Champion.

Recommended Plugins / Features
------------------------------
- H5P (interactive storytelling)
- Level Up XP (or equivalent) for points/levels
- Custom Badges & Badge Management
- Checklist (task tracking)
- Feedback (mentor assessments)
- Certificate (graduation)
- Attendance (cohort tracking)
- Configurable reports / Ad-hoc reporting tool
- Optional: BigBlueButton for live facilitation

Security & Privacy
------------------
- Use HTTPS; enforce MFA for staff accounts
- Privacy segmentation: guardian view opt-in; PII minimization
- Data retention policy for minors; consent records stored
- Audit logging for mentor notes and grade changes

Hosting & Deployment Options
----------------------------
Minimum (Pilot): single Ubuntu VM, Nginx, PHP 8.2+, MariaDB/Postgres, Moodle 4.3+, cron runner, daily backups to object storage.
Scale (Regional/National): separate app & DB servers, object storage for media, CDN, containerized deployment (Docker/K8s), automated CI/CD, monitoring.

Integration & Ops
-----------------
- SMTP for notifications (SendGrid/Mailgun)
- Video: BigBlueButton (self-host) or Zoom integration
- SSO: SAML/OAuth for partner orgs
- Analytics: export data to BI tool or scheduled CSV reports

Deliverables (Immediate Next Steps)
----------------------------------
1. Developer-ready architecture document (this file)
2. Moodle sitemap & course template (JSON / install backup)
3. Role-permission matrix (CSV)
4. Gamification rules matrix (XP thresholds, badge rules)
5. Deployment playbook (server specs, install steps)

Planned Workstream (Phase 1: Pilot)
-----------------------------------
1. Install Moodle on a staging server and configure roles
2. Create the `Hero's Path` master course from the template
3. Add H5P scenario and create 2 pilot weeks as examples
4. Install gamification plugins and configure rank rules
5. Build `Village Guide Certification` course and basic rubric
6. Create pilot reporting dashboard (cohort completion, points)

Next Actions I Will Take (if you confirm)
----------------------------------------
- Produce the `role-permission matrix` and `gamification rules matrix` next.
- Generate Moodle backup template (course export) for the Hero's Path master course.

Files created
-------------
- [Village_Strong_Moodle_Architecture_Developer_Brief.md](Village_Strong_Moodle_Architecture_Developer_Brief.md)

Contact / Notes
---------------
Confirm whether you prefer MariaDB or PostgreSQL for the pilot, and whether BigBlueButton or Zoom is your preferred live-session tool. I will then produce the role matrix and gamification rules as the next deliverables.

Attribution
-----------
Program Developer and Research Lead
Daniel A. Rodriguez

Software Developer and Technical Systems Architect
Rafael Rodriguez Jr.

Suggested placements for credit lines:
- Program overview / homepage (short credit)
- Mentor Handbook and curriculum materials (detailed credit)
- Research & Impact section (research publications and evaluation reports)
