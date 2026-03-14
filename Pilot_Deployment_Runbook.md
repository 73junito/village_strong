# Pilot Deployment Runbook — Village Strong Moodle

This runbook documents prerequisites, validation steps, commands, rollback, and post-restore checks for the pilot restore.

## Prerequisites
- SSH access to the pilot server with sudo privileges
- Backup file (.mbz) available on the server
- `mysql` client installed
- PHP CLI installed
- `unzip` (for archive inspection)

## Key environment variables
- `MOODLE_DIR` (e.g. /var/www/html/moodle)
- `MOODLEDATA_DIR` (e.g. /var/moodledata)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `DB_PREFIX` (usually `mdl_`)
- `PHP_BIN` (e.g. /usr/bin/php)
- `LOG_DIR` (/var/log/village_strong)
- `BBB_MODULE_NAME` (bigbluebuttonbn)

## Validation checklist (automated + manual)
1. Run the automated validator:

```bash
sudo bash scripts/validate_moodle_pilot.sh \
  --moodle-dir /var/www/html/moodle \
  --moodledata /var/moodledata \
  --db-host localhost --db-name moodledb --db-user moodleuser
```

2. Manually inspect `config.php`:
- Confirm `$CFG->wwwroot`, `$CFG->dataroot`, DB settings and prefix.

3. Verify DB connectivity and schema using `mysql` client (interactive checks).
4. Confirm Moodle release and compatibility:
- `php /var/www/html/moodle/admin/cli/checks.php`
- Inspect `version.php` for `$release` and `$version`.

5. Confirm presence of CLI restore tool used by `moodle_restore_and_setup.sh`.
6. Confirm filesystem ownership and permissions (web server user, e.g. `www-data`).
7. Validate roles/cohorts/users/context assumptions (see SQL snippets below).
8. Confirm BigBlueButton module presence before configuring BBB settings.
9. Verify cron runs and task scheduling.
10. Ensure logging path exists and is writable.

## Example DB snippets
- List roles:

```sql
SELECT id,name,shortname,archetype FROM mdl_role;
```

- Check for Program Director role (or equivalent shortname):

```sql
SELECT id,shortname,name FROM mdl_role WHERE shortname LIKE '%program%';
```

- Find Program Director user by username or email:

```sql
SELECT id,username,email,firstname,lastname FROM mdl_user WHERE username='programdirector' OR email='programdirector@example.com';
```

## Restore sequence (test/staging first)
1. Upload `.mbz` to server and verify integrity (`unzip -l`).
2. Run a test restore into a staging category via the Moodle CLI or web UI.
3. Run post-restore checks (see next section).

## Post-restore checks
- Confirm course exists and is visible
- Resolve restored course ID
- Confirm `mdl_context` row for the course exists
- Assign `Program Director` role (only if role exists or created safely)
- Create cohorts `Village Guides` and `Heroes` if missing (use unique `idnumber`)
- Validate BBB activity presence only if BBB module installed
- Inspect logs in `LOG_DIR`

## Rollback plan
- Remove staged course if restore failed:
  - Use Moodle UI or CLI to delete the course
- Restore DB from pre-restore dump if schema changes were applied
- Revert any direct SQL changes (note: avoid direct SQL if possible)

## Safety notes for `moodle_restore_and_setup.sh`
- Always check for existing roles/cohorts before INSERT
- Resolve user IDs dynamically using username/email
- Resolve course context ID using `mdl_context` after restore
- Exit on non-zero SQL/CLI results

## Where to run the validate script and runbook
- Files created:
  - [scripts/validate_moodle_pilot.sh](scripts/validate_moodle_pilot.sh#L1)
  - [Pilot_Deployment_Runbook.md](Pilot_Deployment_Runbook.md#L1)

## Next actions
- Run the validator on the pilot server and share the output.
- If all checks pass, perform a test restore and verify the post-restore checklist.
