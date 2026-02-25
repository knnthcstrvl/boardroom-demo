#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/www/html/boardroom/mysql_dumps"
CONFIG_FILE="/var/www/html/boardroom/storage/app/backup/.mysql-backup.cnf"
DATABASE_NAME="boardroom"
RETENTION_DAYS=7

timestamp="$(TZ=Asia/Manila date +%Y%m%d_%H%M%S)"
outfile="${BACKUP_DIR}/${DATABASE_NAME}_${timestamp}.sql.gz"
tmpfile="${outfile}.tmp"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Missing MySQL config file: ${CONFIG_FILE}" >&2
  exit 1
fi

# Dump directly to gzip and rename only after success to avoid partial backups.
mysqldump --defaults-extra-file="${CONFIG_FILE}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "${DATABASE_NAME}" | gzip -9 > "${tmpfile}"

mv "${tmpfile}" "${outfile}"

# Keep only recent backup archives.
find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DATABASE_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup created: ${outfile}"
