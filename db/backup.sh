#!/usr/bin/env bash
# Logical backup of the linked Supabase project.
# Writes roles.sql, schema.sql, and data.sql under db/supabase/<date>/.
# Requires the Supabase CLI and a project linked in db/supabase.
set -euo pipefail

db_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stamp="$(date +%Y-%m-%d-%H-%M-%S)"
out="${db_dir}/supabase/${stamp}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found on PATH" >&2
  exit 1
fi

if [[ ! -f "${db_dir}/supabase/.temp/project-ref" ]]; then
  echo "No linked project in ${db_dir}/supabase. Run: supabase link --workdir ${db_dir}" >&2
  exit 1
fi

if [[ -e "${out}" ]]; then
  echo "Backup already exists: ${out}" >&2
  exit 1
fi

mkdir -p "${out}"

supabase db dump --linked --workdir "${db_dir}" --role-only --yes -f "${out}/roles.sql"
supabase db dump --linked --workdir "${db_dir}" --yes -f "${out}/schema.sql"
supabase db dump --linked --workdir "${db_dir}" --data-only --use-copy --yes -f "${out}/data.sql"

tar -cvzf "${out}.tar.gz" "${out}"

if [[ -e "${out}" ]]; then
  rm -rf "${out}"
fi

echo "Backup written to ${out}.tar.gz"
