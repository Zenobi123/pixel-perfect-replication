#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit pointer vers une base de développement migrée}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
