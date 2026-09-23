#!/usr/bin/env bash
# Applies migrations 0001-0003 to a scratch database and runs tests/sql/integrity.sql.
# Usage: DATABASE_URL=postgres://user@localhost:5432/scratch scripts/test-sql.sh
# The database needs the Supabase pieces the migrations reference: roles anon/authenticated/service_role, schema auth (users) and storage (buckets).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a scratch PostgreSQL database}"
root="$(cd "$(dirname "$0")/.." && pwd)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth; create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text);
create schema if not exists storage; create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
SQL
for file in "$root"/supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"; done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$root/tests/sql/integrity.sql" 2>&1 | grep -E "NOTICE|ERROR|FAILED" | sed 's/^psql:[^ ]* //'
