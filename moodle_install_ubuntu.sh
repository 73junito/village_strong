#!/usr/bin/env bash
# moodle_install_ubuntu.sh
# Install Moodle 4.3+ on Ubuntu 22.04 (MariaDB + PHP 8.2 + Nginx + Redis)
# Run as root (or with sudo)

set -euo pipefail

# --- Configuration (edit before running) ---
DOMAIN="your.domain.example"
MOODLE_DIR="/var/www/moodle"
MOODLEDATA_DIR="/var/moodledata"
DB_ROOT_PASS="change_root_db_password"
DB_NAME="moodle"
DB_USER="moodleuser"
DB_PASS="change_this_moodle_db_password"
MOODLE_WWW_USER="www-data"
PHP_VERSION=8.2

# Update & prerequisites
apt update
apt -y upgrade
apt -y install curl gnupg2 ca-certificates lsb-release apt-transport-https software-properties-common

# Add PHP repo (Ondřej Surý)
add-apt-repository ppa:ondrej/php -y
apt update

# Install Nginx, MariaDB, Redis, PHP-FPM and required PHP extensions
apt -y install nginx mariadb-server redis-server git unzip \
  php${PHP_VERSION}-fpm php${PHP_VERSION}-cli php${PHP_VERSION}-curl php${PHP_VERSION}-gd php${PHP_VERSION}-intl php${PHP_VERSION}-mbstring php${PHP_VERSION}-xml php${PHP_VERSION}-xmlrpc php${PHP_VERSION}-soap php${PHP_VERSION}-zip php${PHP_VERSION}-mysql php${PHP_VERSION}-gd php${PHP_VERSION}-apcu php${PHP_VERSION}-redis

# Secure MariaDB (basic)
mysql_secure_installation <<EOF
n
Y
Y
Y
Y
EOF

# Create Moodle database and user
mysql -u root <<MYSQL
CREATE DATABASE ${DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
MYSQL

# Create moodle directories
mkdir -p ${MOODLE_DIR}
mkdir -p ${MOODLEDATA_DIR}
chown -R ${MOODLE_WWW_USER}:${MOODLE_WWW_USER} ${MOODLE_DIR} ${MOODLEDATA_DIR}
chmod -R 0770 ${MOODLEDATA_DIR}

# Download Moodle release (stable 4.3) and extract
MOODLE_VERSION="4.3"
cd /tmp
curl -LO https://download.moodle.org/download.php/direct/stable43/moodle-${MOODLE_VERSION}.tgz
tar -xzf moodle-${MOODLE_VERSION}.tgz
rm -rf ${MOODLE_DIR}/*
cp -R moodle/* ${MOODLE_DIR}/
chown -R ${MOODLE_WWW_USER}:${MOODLE_WWW_USER} ${MOODLE_DIR}

# Create initial config.php template (admin completes web setup or use CLI install)
cat > ${MOODLE_DIR}/config.php <<PHP
<?php
unset(
  /* Put the password or other sensitive data here if using non-interactive installs */
);
$CFG = new stdClass();
$CFG->dbtype    = 'mysqli';
$CFG->dblibrary = 'native';
$CFG->dbhost    = 'localhost';
$CFG->dbname    = '${DB_NAME}';
$CFG->dbuser    = '${DB_USER}';
$CFG->dbpass    = '${DB_PASS}';
$CFG->prefix    = 'mdl_';
$CFG->dboptions = array (
  'dbpersist' => 0,
  'dbport' => '',
  'dbsocket' => '',
);
$CFG->wwwroot   = 'https://${DOMAIN}';
$CFG->dataroot  = '${MOODLEDATA_DIR}';
$CFG->admin     = 'admin';
$CFG->directorypermissions = 0770;
require_once(__DIR__ . '/lib/setup.php');
PHP

chown ${MOODLE_WWW_USER}:${MOODLE_WWW_USER} ${MOODLE_DIR}/config.php
chmod 0640 ${MOODLE_DIR}/config.php

# Nginx site configuration (basic)
cat > /etc/nginx/sites-available/moodle <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root ${MOODLE_DIR};

    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ [^/]\.php(/|$) {
        fastcgi_split_path_info ^(.+?\.php)(/.*)$;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_pass unix:/run/php/php${PHP_VERSION}-fpm.sock;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        try_files $uri $uri/ =404;
        expires max;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/moodle /etc/nginx/sites-enabled/moodle
nginx -t
systemctl restart nginx

# Enable and restart PHP-FPM
systemctl enable php${PHP_VERSION}-fpm
systemctl restart php${PHP_VERSION}-fpm

# Cron job for Moodle (as www-data)
echo '*/5 * * * * ${MOODLE_WWW_USER} /usr/bin/php ${MOODLE_DIR}/admin/cli/cron.php >/dev/null' > /etc/cron.d/moodle-cron

# Install composer (optional, for plugin management)
apt -y install composer

# Final notes
cat <<EOF
Moodle files installed at: ${MOODLE_DIR}
Moodle data directory: ${MOODLEDATA_DIR}
Database: ${DB_NAME} (user: ${DB_USER})
Next steps:
 - Visit http://${DOMAIN}/admin/index.php in your browser to complete web-based installation (create admin account)
 - Or run Moodle CLI install scripts: ${MOODLE_DIR}/admin/cli/install.php
 - Review PHP settings (memory_limit, upload_max_filesize) in /etc/php/${PHP_VERSION}/fpm/php.ini
 - Configure Redis as cache/session store (recommended)
 - Install recommended plugins and configure BigBlueButton per `plugin_configuration.md`
EOF

exit 0
