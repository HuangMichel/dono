#!/usr/bin/env bash
# Create a local migration only. This script never connects to a database.
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
shopt -s nullglob

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT
cat supabase/changes/vercel/photo_upload_limit_4mib.sql > "$payload"

migrations=(supabase/migrations/*_vercel_setup.sql)
if (( ${#migrations[@]} > 1 )); then
  echo "Multiple vercel_setup migrations exist. Review them before continuing." >&2
  exit 1
fi
if (( ${#migrations[@]} == 1 )); then
  if cmp -s "$payload" "${migrations[0]}"; then
    echo "Already prepared: ${migrations[0]}"
    exit 0
  fi
  echo "Existing migration differs from the prepared SQL; no file was overwritten." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install the Supabase CLI first: brew install supabase/tap/supabase" >&2
  exit 1
fi
supabase migration new --help >/dev/null
supabase migration new vercel_setup
migrations=(supabase/migrations/*_vercel_setup.sql)
if (( ${#migrations[@]} != 1 )); then
  echo "The CLI did not create one vercel_setup migration. Inspect supabase/migrations." >&2
  exit 1
fi
cp "$payload" "${migrations[0]}"
echo "Prepared: ${migrations[0]}"
echo "Review it, then run supabase migration list and supabase db push --dry-run."
