Moodle Pilot Install — Quick README

Target: Ubuntu 22.04 LTS server (pilot)
Pilot defaults: MariaDB, Nginx, PHP 8.2, Redis (cache), BigBlueButton integration

1) Prepare the server
- Provision an Ubuntu 22.04 VM (2 vCPU / 8GB RAM recommended for pilot)
- Point DNS for `DOMAIN` to the server's public IP

2) Copy files to server
- Upload `moodle_install_ubuntu.sh` to the server (e.g., `/root/`)
- Make it executable: `chmod +x moodle_install_ubuntu.sh`

3) Edit configuration in the script
- Set `DOMAIN`, `DB_ROOT_PASS`, `DB_PASS`, and any other variables at the top of `moodle_install_ubuntu.sh`.

4) Run the installer
```bash
sudo ./moodle_install_ubuntu.sh
```
This performs package installs, creates the `moodle` DB and user, downloads Moodle 4.3, creates directories, basic Nginx site, and prepares a `config.php` template.

5) Finalize Moodle setup (web or CLI)
- Open `http://DOMAIN` in a browser and follow the web installer to create the site admin account and complete plugin checks.
- Or run the CLI installer (non-interactive):
```bash
sudo -u www-data php /var/www/moodle/admin/cli/install.php --wwwroot="https://DOMAIN" --dataroot="/var/moodledata" --dbtype="mysqli" --dbname="moodle" --dbuser="moodleuser" --dbpass="DB_PASS" --fullname="Village Strong Pilot" --shortname="heroes_path_master" --summary="Hero's Path pilot" --adminuser=admin --adminpass="ChangeMe123!" --adminemail=admin@example.org
```

6) Configure Redis (optional but recommended)
- Configure Moodle caching and session handlers to use Redis via Site administration → Plugins → Caching.

7) Install essential plugins
- Install H5P, Level Up XP (or equivalent), BigBlueButtonBN, Badges, Checklist, Certificate, Feedback.

8) Run initial restore
- Upload the course .mbz backup to `/var/www/moodle/backupdata` (or use Moodle UI)
- Run the `moodle_restore_and_setup.sh` script to restore and configure Program Director / cohorts.

9) Post-install checks
- Verify cron is running and last run logs are recent
- Confirm database connection and file permissions
- Test BigBlueButton with a mock session (if BBB server available)

Notes
- BigBlueButton is a separate server/app; if you will self-host BBB, provision a separate BBB server and integrate it with Moodle via the BigBlueButtonBN plugin.
- The install script creates a basic Nginx site; for production, configure SSL (certbot) and harden Nginx/PHP settings.

If you want, I can generate an Ansible playbook next to automate these steps, or convert this into a one-shot provisioning script for a cloud provider (Ubuntu image).