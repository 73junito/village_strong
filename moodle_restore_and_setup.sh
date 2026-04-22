#!/usr/bin/env bash
# moodle_restore_and_setup.sh
# Parameterized restore + initial setup for Village Strong pilot (MariaDB + BigBlueButton)
# Requirements on server: php CLI, mysql client, access to Moodle code path, appropriate permissions.

set -euo pipefail

# --- Configuration (edit or supply via env / CLI args) ---
MOODLE_PATH="/var/www/moodle"            # Path to Moodle install (server)
BACKUP_FILE=""                            # Path to .mbz backup file
CATEGORY_ID=1                               # Moodle category id to restore into (default: 1 = Miscellaneous)
COURSE_SHORTNAME_PREFIX="heroes_path_"    # prefix used for new course shortname
COURSE_FULLNAME="The Hero's Path (restored)"
COURSE_VISIBLE=1
# DB credentials for Moodle (used to create cohorts / role assignments)
DB_NAME="moodle"
DB_USER="moodleuser"
DB_PASS="change_me"
DB_HOST="localhost"
DB_PORT=3306

# Role & cohort names (custom)
PROGRAM_DIRECTOR_USERNAME="program_director"   # existing Moodle username to assign as Program Director
PROGRAM_DIRECTOR_ROLE_SHORTNAME="programdirector"
VILLAGE_GUIDE_COHORT="Village Guides"
HEROES_COHORT="Heroes"
ENABLE_PARENT_GUARDIAN_DEFAULT=0    # 0 = disabled by default

# Logging
LOG_DIR="/var/log/village_strong_imports"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/import_$(date +%Y%m%d_%H%M%S).log"

# Usage
usage(){
  echo "Usage: $0 --backup /path/to/backup.mbz --program-director <username> [--moodle-path /var/www/moodle]"
  exit 1
}

# Parse args (simple)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP_FILE="$2"; shift 2;;
    --program-director) PROGRAM_DIRECTOR_USERNAME="$2"; shift 2;;
    --moodle-path) MOODLE_PATH="$2"; shift 2;;
    --category-id) CATEGORY_ID="$2"; shift 2;;
    --db-name) DB_NAME="$2"; shift 2;;
    --db-user) DB_USER="$2"; shift 2;;
    --db-pass) DB_PASS="$2"; shift 2;;
    --help) usage;;
    *) echo "Unknown arg: $1"; usage;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Error: --backup is required" | tee -a "$LOG_FILE"
  usage
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" | tee -a "$LOG_FILE"
  exit 2
fi

# Log start
echo "Starting restore: $BACKUP_FILE" | tee -a "$LOG_FILE"

# 1) Run Moodle CLI restore
RESTORE_PHP="$MOODLE_PATH/admin/cli/restore_backup.php"
if [[ ! -f "$RESTORE_PHP" ]]; then
  echo "Moodle restore script not found at $RESTORE_PHP" | tee -a "$LOG_FILE"
  exit 3
fi

# Generate a deterministic shortname using timestamp to avoid collisions
TIMESTAMP=$(date +%s)
COURSE_SHORTNAME="${COURSE_SHORTNAME_PREFIX}${TIMESTAMP}"

echo "Restoring course to category $CATEGORY_ID with shortname $COURSE_SHORTNAME" | tee -a "$LOG_FILE"
php "$RESTORE_PHP" --file="$BACKUP_FILE" --categoryid="$CATEGORY_ID" --shortname="$COURSE_SHORTNAME" --fullname="$COURSE_FULLNAME" --visible="$COURSE_VISIBLE" 2>&1 | tee -a "$LOG_FILE"

# After restore, find the new course id
COURSE_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_course WHERE shortname='${COURSE_SHORTNAME}' LIMIT 1;" "$DB_NAME")
if [[ -z "$COURSE_ID" ]]; then
  echo "Failed to discover restored course id for shortname $COURSE_SHORTNAME" | tee -a "$LOG_FILE"
  exit 4
fi
echo "Restored course id: $COURSE_ID" | tee -a "$LOG_FILE"

# Helper SQL execution function
exec_sql(){
  local sql="$1"
  echo "SQL: $sql" | tee -a "$LOG_FILE"
  mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" "$DB_NAME" -e "$sql" 2>>"$LOG_FILE"
}

# 2) Ensure Program Director role exists (create if missing)
ROLE_EXISTS=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_role WHERE shortname='${PROGRAM_DIRECTOR_ROLE_SHORTNAME}' LIMIT 1;" "$DB_NAME" || true)
if [[ -z "$ROLE_EXISTS" ]]; then
  echo "Creating Program Director role (shortname: ${PROGRAM_DIRECTOR_ROLE_SHORTNAME})" | tee -a "$LOG_FILE"
  exec_sql "INSERT INTO mdl_role (name, shortname, description, sortorder, archetype) VALUES ('Program Director','${PROGRAM_DIRECTOR_ROLE_SHORTNAME}','Program Director role for Village Strong program management',50,'manager');"
  ROLE_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_role WHERE shortname='${PROGRAM_DIRECTOR_ROLE_SHORTNAME}' LIMIT 1;" "$DB_NAME")
else
  ROLE_ID=$ROLE_EXISTS
  echo "Program Director role exists with id $ROLE_ID" | tee -a "$LOG_FILE"
fi

# 3) Ensure Village Guide cohort exists
COHORT_EXISTS=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_cohort WHERE name='${VILLAGE_GUIDE_COHORT}' LIMIT 1;" "$DB_NAME" || true)
if [[ -z "$COHORT_EXISTS" ]]; then
  echo "Creating cohort: ${VILLAGE_GUIDE_COHORT}" | tee -a "$LOG_FILE"
  # contextid = site context (system) is typically the id in mdl_context where contextlevel=10 (CONTEXT_SYSTEM)
  SITE_CONTEXT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_context WHERE contextlevel=10 LIMIT 1;" "$DB_NAME")
  exec_sql "INSERT INTO mdl_cohort (contextid, name, idnumber, description, visible, timecreated, timemodified) VALUES (${SITE_CONTEXT_ID}, '${VILLAGE_GUIDE_COHORT}', 'village_guides', 'Initial cohort for Village Guide mentors', 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());"
  COHORT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_cohort WHERE name='${VILLAGE_GUIDE_COHORT}' LIMIT 1;" "$DB_NAME")
else
  COHORT_ID=$COHORT_EXISTS
  echo "Village Guide cohort exists with id $COHORT_ID" | tee -a "$LOG_FILE"
fi

# 4) Ensure Heroes cohort exists (placeholder)
HCOHORT_EXISTS=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_cohort WHERE name='${HEROES_COHORT}' LIMIT 1;" "$DB_NAME" || true)
if [[ -z "$HCOHORT_EXISTS" ]]; then
  echo "Creating cohort: ${HEROES_COHORT}" | tee -a "$LOG_FILE"
  SITE_CONTEXT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_context WHERE contextlevel=10 LIMIT 1;" "$DB_NAME")
  exec_sql "INSERT INTO mdl_cohort (contextid, name, idnumber, description, visible, timecreated, timemodified) VALUES (${SITE_CONTEXT_ID}, '${HEROES_COHORT}', 'heroes', 'Placeholder cohort for program participants', 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());"
  HERO_COHORT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_cohort WHERE name='${HEROES_COHORT}' LIMIT 1;" "$DB_NAME")
else
  HERO_COHORT_ID=$HCOHORT_EXISTS
  echo "Heroes cohort exists with id $HERO_COHORT_ID" | tee -a "$LOG_FILE"
fi

# 5) Enroll Program Director user (create if missing) and assign role in course context
USER_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_user WHERE username='${PROGRAM_DIRECTOR_USERNAME}' LIMIT 1;" "$DB_NAME" || true)
if [[ -z "$USER_ID" ]]; then
  echo "Program Director user '${PROGRAM_DIRECTOR_USERNAME}' not found. Creating placeholder user (change password after)." | tee -a "$LOG_FILE"
  # Create a minimal user; admin should update profile/password after
  DEFAULT_EMAIL="${PROGRAM_DIRECTOR_USERNAME}@example.org"
  exec_sql "INSERT INTO mdl_user (auth, confirmed, mnethostid, username, password, firstname, lastname, email, timecreated, timemodified) VALUES ('manual', 1, 1, '${PROGRAM_DIRECTOR_USERNAME}', '', 'Program', 'Director', '${DEFAULT_EMAIL}', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());"
  USER_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_user WHERE username='${PROGRAM_DIRECTOR_USERNAME}' LIMIT 1;" "$DB_NAME")
fi

# Assign Program Director role in course context
COURSE_CONTEXT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_context WHERE contextlevel=50 AND instanceid=${COURSE_ID} LIMIT 1;" "$DB_NAME")
if [[ -z "$COURSE_CONTEXT_ID" ]]; then
  echo "Creating course context for course id ${COURSE_ID}" | tee -a "$LOG_FILE"
  # Creating a course context via direct SQL is risky; typically Moodle creates it on restore. Re-query after short pause.
  sleep 2
  COURSE_CONTEXT_ID=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_context WHERE contextlevel=50 AND instanceid=${COURSE_ID} LIMIT 1;" "$DB_NAME")
fi

if [[ -z "$COURSE_CONTEXT_ID" ]]; then
  echo "Failed to find course context; aborting role assignment" | tee -a "$LOG_FILE"
else
  # Check if role assignment already exists
  ASSIGN_EXISTS=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT id FROM mdl_role_assignments WHERE roleid=${ROLE_ID} AND contextid=${COURSE_CONTEXT_ID} AND userid=${USER_ID} LIMIT 1;" "$DB_NAME" || true)
  if [[ -z "$ASSIGN_EXISTS" ]]; then
    echo "Assigning Program Director role (id=${ROLE_ID}) to user id ${USER_ID} in course context ${COURSE_CONTEXT_ID}" | tee -a "$LOG_FILE"
    exec_sql "INSERT INTO mdl_role_assignments (roleid, contextid, userid, timemodified, modifierid) VALUES (${ROLE_ID}, ${COURSE_CONTEXT_ID}, ${USER_ID}, UNIX_TIMESTAMP(), ${USER_ID});"
  else
    echo "Role assignment already exists." | tee -a "$LOG_FILE"
  fi
fi

# 6) Prepare Village Guide cohort for mentor assignment (no members yet)
# Optionally link cohort to course as cohort enrolment spot (requires enrol_cohort plugin configured)
# We'll create a record in mdl_cohort with id already present in COHORT_ID. Link to course via enrol/instances later in UI or via plugin config.

# 7) BigBlueButton defaults: ensure restored course has BBB activities enabled and moderator role set to program's mentor role
# Set moderation mapping in mdl_bigbluebuttonbn if needed; leaving as manual step in UI for pilot.

# 8) Preserve badges and completion: restore already preserves these if included in backup. Confirm badge entries exist
BADGE_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" -sN -e "SELECT COUNT(*) FROM mdl_badge WHERE courseid=${COURSE_ID};" "$DB_NAME" || echo "0")
echo "Badges in restored course: $BADGE_COUNT" | tee -a "$LOG_FILE"

# Final log
echo "Restore and setup complete for course id ${COURSE_ID}. Log: ${LOG_FILE}" | tee -a "$LOG_FILE"

echo "Done." | tee -a "$LOG_FILE"

# End of script
