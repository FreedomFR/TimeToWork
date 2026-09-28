#!/bin/sh
# TimeToWork database backups.
#
#   backup.sh run                      back up every BACKUP_INTERVAL_MINUTES, forever (what the container does)
#   backup.sh once                     one backup now, then exit
#   backup.sh list                     list the backups
#   backup.sh restore <file> [db]      restore a backup (into `db`, default: the live database)
#   backup.sh health                   exit 0 if a recent backup exists (used by the container's healthcheck)
#
# The connection comes from the standard PG* variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
# Backups are compressed pg_dump files (`.dump`, custom format) in BACKUP_DIR, named
# timetowork_YYYYMMDD_HHMMSS.dump (UTC). They contain everything, password hashes included:
# keep the folder private.
set -u

BACKUP_DIR="${BACKUP_DIR:-/backups}"
INTERVAL_MIN="${BACKUP_INTERVAL_MINUTES:-1440}"   # how often
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"               # backups older than this are deleted...
KEEP_MIN="${BACKUP_KEEP_MIN:-3}"                  # ...but the newest ones are always kept, whatever their age
RETRY_MIN=15                                      # after a failed backup, try again sooner than the interval
PREFIX="timetowork"

log() { printf '[backup] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
die() { log "ERROR: $*"; exit 1; }

require_number() { # name value
  case "$2" in ''|*[!0-9]*) die "$1 must be a whole number, got '$2'" ;; esac
}

check_settings() {
  require_number BACKUP_INTERVAL_MINUTES "$INTERVAL_MIN"
  require_number BACKUP_KEEP_DAYS "$KEEP_DAYS"
  require_number BACKUP_KEEP_MIN "$KEEP_MIN"
  [ "$INTERVAL_MIN" -ge 1 ] || die "BACKUP_INTERVAL_MINUTES must be at least 1"
}

# Backups newest first (empty when there is none)
newest_first() { ls -1t "$BACKUP_DIR"/${PREFIX}_*.dump 2>/dev/null; }

minutes_since_last() {
  newest=$(newest_first | head -n 1)
  [ -n "$newest" ] || return 1
  echo $(( ($(date +%s) - $(stat -c %Y "$newest")) / 60 ))
}

# Deletes backups older than KEEP_DAYS, always sparing the KEEP_MIN newest ones
rotate() {
  newest_first | tail -n +$((KEEP_MIN + 1)) | while read -r file; do
    if [ -n "$(find "$file" -mtime +"$KEEP_DAYS" 2>/dev/null)" ]; then
      rm -f "$file" && log "deleted (older than $KEEP_DAYS days): $file"
    fi
  done
}

# One backup. Written to a temporary name and renamed once verified, so a half-written or
# unreadable file never looks like a good backup.
backup_once() {
  mkdir -p "$BACKUP_DIR" || return 1
  final="$BACKUP_DIR/${PREFIX}_$(date -u +%Y%m%d_%H%M%S).dump"
  # Two backups in the same second must not overwrite each other
  base="${final%.dump}"; n=1
  while [ -e "$final" ]; do final="${base}_$n.dump"; n=$((n + 1)); done
  tmp="$final.tmp"

  if ! pg_dump --format=custom --no-owner --no-privileges --file="$tmp"; then
    log "ERROR: pg_dump failed"
    rm -f "$tmp"
    return 1
  fi
  if [ ! -s "$tmp" ] || ! pg_restore --list "$tmp" >/dev/null 2>&1; then
    log "ERROR: the dump is empty or unreadable, discarded"
    rm -f "$tmp"
    return 1
  fi

  mv "$tmp" "$final"
  log "OK: $final ($(du -h "$final" | cut -f1))"
  rotate
}

sleep_minutes() { # interruptible, so the container stops at once
  sleep $(( $1 * 60 )) &
  wait $!
}

run() {
  check_settings
  trap 'log "stopping"; exit 0' TERM INT
  log "every $INTERVAL_MIN min, keeping $KEEP_DAYS days (at least the last $KEEP_MIN) in $BACKUP_DIR"

  until pg_isready -q; do log "waiting for the database..."; sleep 3; done

  # Restarting the stack must not add a backup each time: wait out what is left of the interval
  if age=$(minutes_since_last) && [ "$age" -lt "$INTERVAL_MIN" ]; then
    log "the last backup is $age min old: next one in $((INTERVAL_MIN - age)) min"
    sleep_minutes $((INTERVAL_MIN - age))
  fi

  while true; do
    if backup_once; then
      sleep_minutes "$INTERVAL_MIN"
    else
      wait_min=$RETRY_MIN
      [ "$INTERVAL_MIN" -lt "$wait_min" ] && wait_min=$INTERVAL_MIN
      log "will retry in $wait_min min"
      sleep_minutes "$wait_min"
    fi
  done
}

# Healthy = there is a backup no older than two intervals (plus a margin)
health() {
  check_settings
  age=$(minutes_since_last) || { echo "no backup yet"; exit 1; }
  [ "$age" -le $((2 * INTERVAL_MIN + 20)) ] || { echo "last backup is $age min old"; exit 1; }
  echo "last backup $age min ago"
}

# Restores `file` into `target` (default: the live database). Before touching the live database it
# saves a copy of it (pre-restore_*.dump, never rotated), so a restore can itself be undone.
restore() {
  file="${1:-}"; target="${2:-${PGDATABASE:-}}"
  [ -n "$file" ] || die "usage: backup.sh restore <file> [database]"
  [ -f "$file" ] || file="$BACKUP_DIR/$file"
  [ -f "$file" ] || die "no such backup: $1"
  pg_restore --list "$file" >/dev/null 2>&1 || die "$file is not a valid backup"
  [ -n "$target" ] || die "no target database (set PGDATABASE or pass one)"

  exists=$(psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$target'") || die "cannot reach the database server"
  if [ "$exists" = "1" ]; then
    if [ "$target" = "${PGDATABASE:-}" ]; then
      safety="$BACKUP_DIR/pre-restore_$(date -u +%Y%m%d_%H%M%S).dump"
      log "saving the current '$target' first: $safety"
      pg_dump --dbname="$target" --format=custom --no-owner --no-privileges --file="$safety" || die "could not save the current database, restore cancelled"
    fi
  else
    log "creating database '$target'"
    createdb "$target" || die "could not create '$target'"
  fi

  log "restoring $file into '$target'..."
  # --clean --if-exists replaces the tables that are there; errors from objects that do not exist yet are harmless
  pg_restore --dbname="$target" --clean --if-exists --no-owner --no-privileges "$file" || log "pg_restore reported warnings (see above)"
  log "restore finished"
}

case "${1:-run}" in
  run) run ;;
  once) check_settings; until pg_isready -q; do sleep 2; done; backup_once ;;
  list) ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || echo "no backup in $BACKUP_DIR" ;;
  restore) shift; restore "$@" ;;
  health) health ;;
  *) die "unknown command '$1' (run | once | list | restore <file> [db] | health)" ;;
esac
