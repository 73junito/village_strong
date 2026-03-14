#!/usr/bin/env bash

############################################
# Strict execution mode
############################################
set -euo pipefail

############################################
# Configurable environment variables
############################################

MOODLE_DIR="${MOODLE_DIR:-/var/www/html/moodle}"
MOODLEDATA_DIR="${MOODLEDATA_DIR:-/var/moodledata}"

DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-moodledb}"
DB_USER="${DB_USER:-moodleuser}"
DB_PASS="${DB_PASS:-}"

DB_PREFIX="${DB_PREFIX:-mdl_}"

PROGRAM_DIRECTOR_USERNAME="${PROGRAM_DIRECTOR_USERNAME:-programdirector}"

VILLAGE_GUIDE_COHORT_NAME="${VILLAGE_GUIDE_COHORT_NAME:-Village Guides}"
HEROES_COHORT_NAME="${HEROES_COHORT_NAME:-Heroes}"

PHP_BIN="${PHP_BIN:-/usr/bin/php}"

LOG_DIR="${LOG_DIR:-/var/log/village_strong}"

BBB_MODULE_NAME="${BBB_MODULE_NAME:-bigbluebuttonbn}"

DRY_RUN="${DRY_RUN:-false}"

############################################
# Logging
############################################

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/moodle_restore_$(date +%F_%H-%M-%S).log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "-------------------------------------"
echo "Village Strong Moodle Restore Script"
echo "Started: $(date)"
echo "-------------------------------------"

if [ "$DRY_RUN" = true ]; then
    echo "DRY RUN MODE ENABLED — no changes will be applied"
fi

############################################
# Environment Verification
############################################

echo "Checking environment..."

[ -d "$MOODLE_DIR" ] || { echo "ERROR: Moodle directory not found: $MOODLE_DIR"; exit 1; }

[ -d "$MOODLEDATA_DIR" ] || { echo "ERROR: Moodledata directory not found: $MOODLEDATA_DIR"; exit 1; }

command -v php >/dev/null || { echo "ERROR: PHP CLI not installed"; exit 1; }

command -v mysql >/dev/null || { echo "ERROR: MySQL client not installed"; exit 1; }

echo "Environment OK"

############################################
# Database Connectivity Check
############################################

echo "Checking database connectivity..."

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1;" \
  || { echo "ERROR: Database connection failed"; exit 1; }

echo "Database connection OK"

############################################
# Detect DB Prefix (if not provided)
############################################

if [ -z "${DB_PREFIX:-}" ]; then

  echo "Detecting Moodle DB prefix..."

  DB_PREFIX=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    -e "SHOW TABLES LIKE '%config%';" | head -n1 | sed 's/config//')

  echo "Detected prefix: $DB_PREFIX"

fi

############################################
# Resolve Program Director User
############################################

echo "Resolving Program Director account..."

PD_USER_ID=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT id FROM ${DB_PREFIX}user WHERE username='$PROGRAM_DIRECTOR_USERNAME' AND deleted=0;")

if [ -z "$PD_USER_ID" ]; then
    echo "ERROR: Program Director user not found"
    exit 1
fi

echo "Program Director ID: $PD_USER_ID"

############################################
# Role Existence Check
############################################

echo "Checking Program Director role..."

ROLE_EXISTS=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT id FROM ${DB_PREFIX}role WHERE shortname='programdirector';")

if [ -z "$ROLE_EXISTS" ]; then

    echo "Program Director role does not exist"

    if [ "$DRY_RUN" = false ]; then

        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
INSERT INTO ${DB_PREFIX}role
(name, shortname, description, archetype, contextlevel)
VALUES
('Program Director','programdirector','Village Strong Program Director role','manager',10);
SQL

    fi

else

    echo "Program Director role already exists"

fi

############################################
# Cohort Checks
############################################

echo "Checking Village Guide cohort..."

VG_COHORT_EXISTS=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT id FROM ${DB_PREFIX}cohort WHERE name='$VILLAGE_GUIDE_COHORT_NAME';")

if [ -z "$VG_COHORT_EXISTS" ]; then

    echo "Village Guide cohort not found"

    if [ "$DRY_RUN" = false ]; then

        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
INSERT INTO ${DB_PREFIX}cohort (name, contextid)
VALUES ('$VILLAGE_GUIDE_COHORT_NAME',1);
SQL

    fi

else

    echo "Village Guide cohort already exists"

fi


echo "Checking Heroes cohort..."

HEROES_EXISTS=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT id FROM ${DB_PREFIX}cohort WHERE name='$HEROES_COHORT_NAME';")

if [ -z "$HEROES_EXISTS" ]; then

    echo "Heroes cohort not found"

    if [ "$DRY_RUN" = false ]; then

        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
INSERT INTO ${DB_PREFIX}cohort (name, contextid)
VALUES ('$HEROES_COHORT_NAME',1);
SQL

    fi

else

    echo "Heroes cohort already exists"

fi

############################################
# BigBlueButton Detection
############################################

echo "Checking BigBlueButton plugin..."

BBB_PRESENT=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT name FROM ${DB_PREFIX}modules WHERE name='$BBB_MODULE_NAME';")

if [ -z "$BBB_PRESENT" ]; then
    echo "BigBlueButton plugin not detected — skipping BBB configuration"
else
    echo "BigBlueButton plugin detected"
fi

############################################
# Script completion
############################################

echo "-------------------------------------"
echo "Restore script initialization complete"
echo "Log file: $LOG_FILE"
echo "-------------------------------------"
