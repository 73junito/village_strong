#!/usr/bin/env bash

set -euo pipefail

################################
# Config
################################

MOODLE_DIR="${MOODLE_DIR:-/var/www/html/moodle}"
MOODLEDATA_DIR="${MOODLEDATA_DIR:-/var/moodledata}"

DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-moodledb}"
DB_USER="${DB_USER:-moodleuser}"
DB_PASS="${DB_PASS:-}"

DB_PREFIX="${DB_PREFIX:-mdl_}"

BACKUP_FILE="${BACKUP_FILE:-/backups/hero_path_blueprint.mbz}"

BBB_MODULE_NAME="${BBB_MODULE_NAME:-bigbluebuttonbn}"

echo "-----------------------------------"
echo "Village Strong Moodle Validator"
echo "-----------------------------------"

################################
# Check directories
################################

echo "Checking Moodle directory..."

[ -d "$MOODLE_DIR" ] || { echo "FAIL: Moodle directory missing"; exit 1; }

echo "OK"

echo "Checking moodledata..."

[ -d "$MOODLEDATA_DIR" ] || { echo "FAIL: moodledata missing"; exit 1; }

echo "OK"

################################
# CLI tools
################################

echo "Checking PHP CLI..."

command -v php >/dev/null || { echo "FAIL: PHP CLI missing"; exit 1; }

echo "OK"

echo "Checking MySQL CLI..."

command -v mysql >/dev/null || { echo "FAIL: mysql client missing"; exit 1; }

echo "OK"

################################
# Moodle CLI restore tool
################################

echo "Checking Moodle restore CLI..."

[ -f "$MOODLE_DIR/admin/cli/restore_backup.php" ] || {
    echo "FAIL: restore_backup.php missing"
    exit 1
}

echo "OK"

################################
# Database connectivity
################################

echo "Checking database connection..."

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1;" \
  || { echo "FAIL: cannot connect to database"; exit 1; }

echo "OK"

################################
# Check core Moodle tables
################################

echo "Checking Moodle tables..."

mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SHOW TABLES LIKE '${DB_PREFIX}user';" | grep user >/dev/null \
  || { echo "FAIL: Moodle tables not detected"; exit 1; }

echo "OK"

################################
# BigBlueButton plugin
################################

echo "Checking BigBlueButton plugin..."

BBB_PRESENT=$(mysql -N -s -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT name FROM ${DB_PREFIX}modules WHERE name='$BBB_MODULE_NAME';")

if [ -z "$BBB_PRESENT" ]; then
    echo "WARNING: BigBlueButton plugin not installed"
else
    echo "OK"
fi

################################
# Backup file check
################################

echo "Checking course backup file..."

[ -f "$BACKUP_FILE" ] || { echo "FAIL: backup file not found"; exit 1; }

echo "OK"

################################
# Validation complete
################################

echo "-----------------------------------"
echo "VALIDATION COMPLETE"
echo "Environment ready for deployment"
echo "-----------------------------------"

