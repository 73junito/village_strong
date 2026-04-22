Village Strong — Moodle Developer Package (Pilot)

Pilot defaults
- Database: MariaDB
- Live sessions: BigBlueButton
- Web: Nginx + PHP-FPM
- Cache/session: Redis
- Storage: local filesystem (pilot), object storage for backups
- Mail: SMTP (SendGrid/Mailgun or institutional SMTP)

Purpose
This package codifies assumptions, configuration guidance, and deliverables Rafael will use to deploy the pilot Moodle instance for Village Strong.

Contents
- Course import template guidance (see `Course_Import_Template.md`)
- Role-permission matrix (`role_permission_matrix.csv`)
- Gamification rules matrix (`gamification_rules.md`)
- Plugin configuration notes (`plugin_configuration.md`)
- Theme notes and asset list (`theme_notes.md`)
- DB/entity planning (`db_entity_diagram.md`)

Quick deployment checklist (pilot)
1. Provision Ubuntu 22.04 LTS VM (2 vCPU / 8GB RAM / 80GB disk) for staging.
2. Install Nginx, PHP 8.2-FPM, MariaDB 10.6+, Redis server, Git, and certbot.
3. Create `moodle` DB and `moodle` DB user in MariaDB with strong password.
4. Download and install Moodle 4.3+ into `/var/www/moodle` and set file permissions.
5. Configure PHP-FPM with recommended Moodle settings (memory_limit, upload_max_filesize, post_max_size, max_execution_time).
6. Configure Nginx site with secure TLS and recommended headers.
7. Configure Redis as session handler and application cache (optional but recommended).
8. Configure cron job for Moodle cron (run every 5 minutes for pilot).
9. Install BigBlueButton integration plugin and configure BBB server endpoint.
10. Install essential plugins (see `plugin_configuration.md`) and configure.
11. Import the `Hero's Path` course template backup or build from the course import guide.
12. Create initial roles and cohorts; test mentor workflows and reflection privacy settings.
13. Configure daily/nightly backups to remote object storage.

BigBlueButton notes
- For pilot, use a single BBB server (self-hosted) sized for expected concurrent mentors. Small pilot: 4-6 concurrent rooms; scale server accordingly.
- Integrate BBB with Moodle via the BBB activity module; set moderator role to `Village Guide`.
- Enable breakout rooms and recording settings appropriate to consent/policy.

MariaDB notes
- Default pilot: MariaDB 10.6+; ensure `innodb_file_per_table=1`, `innodb_buffer_pool_size` set based on RAM (for pilot ~2-4GB), and `max_allowed_packet` increased.
- Backups: use `mysqldump` or filesystem snapshots + binary logs for point-in-time recovery.

Migration note
- Document schema differences and export procedures in case of later migration to PostgreSQL. Use standard Moodle migration steps if needed.

Files created by this package
- `role_permission_matrix.csv`
- `gamification_rules.md`
- `plugin_configuration.md`
- `theme_notes.md`
- `db_entity_diagram.md`
- `Course_Import_Template.md`

Next steps
- Generate the role-permission CSV and gamification rules file.
- Produce a starter course import guide (manual steps + recommended settings).