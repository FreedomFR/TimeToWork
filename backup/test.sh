#!/bin/sh
# Tests of backup.sh, run inside the backup container against throwaway databases (never the real one):
#
#   docker compose run --rm --entrypoint /bin/sh backup /scripts/test.sh
#
# Creates backup_test_src / backup_test_dst, works in /tmp/backup-test, and removes all of it at the end.
set -u

SCRIPT=/scripts/backup.sh
DIR=/tmp/backup-test
COPY=/tmp/backup-test-copy
SRC=backup_test_src
DST=backup_test_dst
export BACKUP_DIR="$DIR"
export BACKUP_KEEP_DAYS=14 BACKUP_KEEP_MIN=3 BACKUP_INTERVAL_MINUTES=1440

passed=0; failed=0
ok()   { passed=$((passed + 1)); printf '  ok    %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf '  FAIL  %s\n' "$1"; }
check() { # description, command...
  desc="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$desc"; else fail "$desc"; fi
}
check_not() { desc="$1"; shift; if "$@" >/dev/null 2>&1; then fail "$desc"; else ok "$desc"; fi; }
equal() { # description, expected, actual
  if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 (expected '$2', got '$3')"; fi
}

sql() { psql -d "$1" -Atc "$2"; }
count_dumps() { ls "$DIR"/timetowork_*.dump 2>/dev/null | wc -l | tr -d ' '; }
count_copies() { ls "$COPY"/timetowork_*.dump 2>/dev/null | wc -l | tr -d ' '; }
# A copy of a real backup, made to look `days` days old
age_copy() { # source, name, days
  cp "$1" "$DIR/$2"
  touch -t "$(date -d "@$(( $(date +%s) - $3 * 86400 ))" +%Y%m%d%H%M)" "$DIR/$2"
}

cleanup() {
  psql -d postgres -Atc "DROP DATABASE IF EXISTS $SRC" >/dev/null 2>&1
  psql -d postgres -Atc "DROP DATABASE IF EXISTS $DST" >/dev/null 2>&1
  rm -rf "$DIR" "$COPY" /tmp/backup-source.dump
}
trap cleanup EXIT
cleanup
mkdir -p "$DIR"

echo "== set-up"
psql -d postgres -Atc "CREATE DATABASE $SRC" >/dev/null || { echo "cannot reach the database"; exit 2; }
sql "$SRC" "CREATE TABLE person (id serial PRIMARY KEY, name text); INSERT INTO person (name) VALUES ('Ada'), ('Grace'), ('Édith'), ('Linus');" >/dev/null
export PGDATABASE="$SRC"

echo "== one backup"
sh "$SCRIPT" once >/dev/null 2>&1
equal "creates exactly one backup" 1 "$(count_dumps)"
FIRST=$(ls "$DIR"/timetowork_*.dump | head -n 1)
check "the file is a valid dump" pg_restore --list "$FIRST"
check "no temporary file is left" sh -c "! ls $DIR/*.tmp"
check "the name is timetowork_YYYYMMDD_HHMMSS.dump" sh -c "basename $FIRST | grep -Eq '^timetowork_[0-9]{8}_[0-9]{6}\.dump$'"

echo "== restore"
sh "$SCRIPT" restore "$FIRST" "$DST" >/dev/null 2>&1
equal "restores into a new database (created on the fly)" 4 "$(sql "$DST" 'SELECT count(*) FROM person')"
equal "keeps accents and content" "Édith" "$(sql "$DST" "SELECT name FROM person WHERE id = 3")"
check "accepts a bare file name" sh "$SCRIPT" restore "$(basename "$FIRST")" "$DST"
check_not "refuses a missing file" sh "$SCRIPT" restore nope.dump "$DST"
echo "this is not a dump" > "$DIR/garbage.dump"
check_not "refuses a file that is not a dump" sh "$SCRIPT" restore garbage.dump "$DST"
equal "the target is untouched after a refused restore" 4 "$(sql "$DST" 'SELECT count(*) FROM person')"

echo "== restore over the live database keeps a safety copy"
export PGDATABASE="$DST"
sql "$DST" "DELETE FROM person WHERE id > 1" >/dev/null
equal "(the live database was damaged)" 1 "$(sql "$DST" 'SELECT count(*) FROM person')"
sh "$SCRIPT" restore "$FIRST" >/dev/null 2>&1
equal "the damage is repaired by the restore" 4 "$(sql "$DST" 'SELECT count(*) FROM person')"
SAFETY=$(ls "$DIR"/pre-restore_*.dump 2>/dev/null | head -n 1)
check "a pre-restore copy exists" test -n "$SAFETY"
check "the pre-restore copy is a valid dump" pg_restore --list "$SAFETY"
export PGDATABASE="$SRC"

echo "== rotation: old backups go, the newest few stay"
rm -f "$DIR"/pre-restore_*.dump "$DIR"/garbage.dump
# Set the first backup aside: the aged copies are made from it, and it must not count as one of the "newest"
cp "$FIRST" /tmp/backup-source.dump
rm -f "$FIRST"
for spec in "a_30d.dump 30" "b_29d.dump 29" "c_28d.dump 28" "d_20d.dump 20" "e_16d.dump 16"; do
  set -- $spec
  age_copy /tmp/backup-source.dump "timetowork_20200101_0000${1%%_*}.dump" "$2"
done
equal "(five aged backups before)" 5 "$(count_dumps)"
sh "$SCRIPT" once >/dev/null 2>&1
# newest first: new, 16d, 20d | 28d, 29d, 30d -> the last three are older than 14 days and are not among the 3 newest
equal "keeps the 3 newest, deletes the older ones" 3 "$(count_dumps)"
check "the 16-day-old one is spared (among the 3 newest)" ls "$DIR"/timetowork_20200101_0000e.dump
check "the 20-day-old one is spared (among the 3 newest)" ls "$DIR"/timetowork_20200101_0000d.dump
check_not "the 28-day-old one is deleted" ls "$DIR"/timetowork_20200101_0000c.dump

BACKUP_KEEP_MIN=1 sh "$SCRIPT" once >/dev/null 2>&1
equal "with BACKUP_KEEP_MIN=1 the old ones go too" 2 "$(count_dumps)"
check_not "the 16-day-old one is now deleted" ls "$DIR"/timetowork_20200101_0000e.dump

echo "== copy to a second folder"
rm -f "$DIR"/*.dump
export BACKUP_COPY_DIR="$COPY"
sh "$SCRIPT" once >/dev/null 2>&1
equal "the backup is copied (folder created on the fly)" 1 "$(count_copies)"
equal "under the same name" "$(basename "$(ls "$DIR"/timetowork_*.dump)")" "$(basename "$(ls "$COPY"/timetowork_*.dump)")"
check "the copy is a valid dump" pg_restore --list "$(ls "$COPY"/timetowork_*.dump)"
check "no temporary file is left in the copy folder" sh -c "! ls $COPY/*.tmp"
sleep 1; sh "$SCRIPT" once >/dev/null 2>&1
equal "every new backup is copied too" 2 "$(count_copies)"
check "health is fine with a fresh copy" sh "$SCRIPT" health

rm -f "$COPY"/*.dump
sh "$SCRIPT" once >/dev/null 2>&1
equal "copies that were missed are caught up" 3 "$(count_copies)"

rm -f "$COPY"/*.dump
check_not "health fails when the copy is empty" sh "$SCRIPT" health
sh "$SCRIPT" once >/dev/null 2>&1

# Old copies follow the same rotation as the backups
cp -p "$(ls "$DIR"/timetowork_*.dump | head -n 1)" "$COPY/timetowork_20200101_000000.dump"
touch -t "$(date -d "@$(( $(date +%s) - 40 * 86400 ))" +%Y%m%d%H%M)" "$COPY/timetowork_20200101_000000.dump"
BACKUP_KEEP_MIN=1 sh "$SCRIPT" once >/dev/null 2>&1
check_not "an old copy is rotated like the backups" ls "$COPY"/timetowork_20200101_000000.dump

# A copy folder that cannot be written to must not lose the backup
before=$(count_dumps)
check "a copy folder that cannot be written to does not fail the backup" env BACKUP_COPY_DIR=/proc/nope sh "$SCRIPT" once
equal "the backup itself is still taken" "$((before + 1))" "$(count_dumps)"
check_not "but health reports it" env BACKUP_COPY_DIR=/proc/nope sh "$SCRIPT" health
unset BACKUP_COPY_DIR

echo "== failures"
before=$(count_dumps)
check_not "a backup of a database that does not exist fails" env PGDATABASE=does_not_exist sh "$SCRIPT" once
equal "and leaves no file behind" "$before" "$(count_dumps)"
check "and no temporary file" sh -c "! ls $DIR/*.tmp"
check_not "rejects a non-numeric interval" env BACKUP_INTERVAL_MINUTES=abc sh "$SCRIPT" once
check_not "rejects a zero interval" env BACKUP_INTERVAL_MINUTES=0 sh "$SCRIPT" once
check_not "rejects a negative retention" env BACKUP_KEEP_DAYS=-1 sh "$SCRIPT" once
check_not "rejects an unknown command" sh "$SCRIPT" explode

echo "== health"
check "healthy right after a backup" sh "$SCRIPT" health
rm -f "$DIR"/*.dump
check_not "unhealthy when there is no backup" sh "$SCRIPT" health
sh "$SCRIPT" once >/dev/null 2>&1
LATEST=$(ls "$DIR"/timetowork_*.dump | head -n 1)
touch -t "$(date -d "@$(( $(date +%s) - 3 * 86400 ))" +%Y%m%d%H%M)" "$LATEST"
check_not "unhealthy when the last backup is older than two intervals" sh "$SCRIPT" health
check "healthy with a longer interval" env BACKUP_INTERVAL_MINUTES=4320 sh "$SCRIPT" health

echo "== the loop"
rm -f "$DIR"/*.dump
sh "$SCRIPT" run > "$DIR/run.log" 2>&1 &
PID=$!
sleep 6
equal "takes a first backup as soon as it starts" 1 "$(count_dumps)"
kill -TERM "$PID" 2>/dev/null
wait "$PID" 2>/dev/null
check "stops on SIGTERM" sh -c "! kill -0 $PID"
check "says so in its log" grep -q "stopping" "$DIR/run.log"

# A recent backup exists: starting again must not add another one, and must say when the next is due
sh "$SCRIPT" run > "$DIR/run2.log" 2>&1 &
PID=$!
sleep 6
equal "a restart does not add a backup while the last one is recent" 1 "$(count_dumps)"
check "and it announces the wait" grep -q "next one in" "$DIR/run2.log"
kill -TERM "$PID" 2>/dev/null
wait "$PID" 2>/dev/null

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
