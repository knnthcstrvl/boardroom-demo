#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/html/boardroom"
PHP_BIN="/usr/bin/php"
ARTISAN="$APP_DIR/artisan"
LOG_FILE="$APP_DIR/storage/logs/queue-worker.log"
PID_PATTERN="/usr/bin/php /var/www/html/boardroom/artisan queue:work database --sleep=3 --tries=3 --timeout=120 --queue=default"

cd "$APP_DIR"

if pgrep -f "$PID_PATTERN" >/dev/null 2>&1; then
  exit 0
fi

nohup "$PHP_BIN" "$ARTISAN" queue:work database --sleep=3 --tries=3 --timeout=120 --queue=default >> "$LOG_FILE" 2>&1 &
