#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL doit pointer vers une base de développement migrée}"
: "${GOLDEN_TEST_USER_ID:?GOLDEN_TEST_USER_ID doit référencer un utilisateur auth.users de test}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v uid="'$GOLDEN_TEST_USER_ID'" -f supabase/tests/golden_ecritures.sql
