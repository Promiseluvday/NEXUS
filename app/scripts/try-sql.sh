#!/bin/sh
# Try a migration and its pgTAP test file against the running local database
# WITHOUT keeping anything: everything runs in one transaction that is rolled
# back. Lets several people (or builders) test new migrations at the same time.
#   sh scripts/try-sql.sh supabase/migrations/2026..._x.sql supabase/tests/x.test.sql
# The test file's own begin; / rollback; lines are skipped.
set -e
MIG="$1"; TEST="$2"
TMP=$(mktemp)
{
  echo "begin;"
  cat "$MIG"
  echo
  [ -n "$TEST" ] && grep -v -E '^\s*(begin|rollback)\s*;\s*$' "$TEST"
  echo
  echo "rollback;"
} > "$TMP"
docker exec -i supabase_db_nexus-mro psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$TMP"
rm -f "$TMP"
