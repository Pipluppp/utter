#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "[1/7] Checking Node.js + npm..."
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node was not found on PATH."
  echo "Install Node.js 20+ and rerun this script."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm was not found on PATH."
  echo "Install Node.js 20+ and rerun this script."
  exit 1
fi
node --version
npm --version

echo "[2/7] Installing Wrangler CLI (local devDependency)..."
npm install -D wrangler@latest

echo "[3/7] Verifying Cloudflare auth..."
npx wrangler --version
if ! npx wrangler whoami >/dev/null 2>&1; then
  echo "No active Wrangler session. Starting login flow..."
  npx wrangler login
fi
npx wrangler whoami

echo "[4/7] Verifying Supabase auth..."
npx supabase --version
if ! npx supabase projects list >/dev/null 2>&1; then
  echo "No active Supabase session. Starting login flow..."
  npx supabase login
fi
npx supabase projects list

echo "[5/7] Checking Supabase project link..."
if [[ -f supabase/.temp/project-ref ]]; then
  echo "Existing linked project:"
  cat supabase/.temp/project-ref
else
  echo "Project is not linked yet. Run:"
  echo "  npx supabase link --project-ref jgmivviwockcwjkvpqra"
fi

echo "[6/7] Checking Cloudflare resources visibility..."
echo "Run manually and verify expected resources:"
echo "  npx wrangler r2 bucket list"
echo "  npx wrangler queues list"
echo "  npx wrangler pages project list"

echo "[7/7] Bootstrap complete."
