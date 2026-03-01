@echo off
setlocal

set REPO_ROOT=%~dp0..\..
pushd "%REPO_ROOT%"

echo [1/7] Checking Node.js + npm...
npm --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found on PATH.
  echo Install Node.js 20+ and rerun this script.
  popd
  exit /b 1
)
node --version
npm --version

echo [2/7] Installing Wrangler CLI (local devDependency)...
npm install -D wrangler@latest
if errorlevel 1 (
  echo ERROR: Failed to install wrangler.
  popd
  exit /b 1
)

echo [3/7] Verifying Cloudflare auth...
npx wrangler --version || goto :fail
npx wrangler whoami >nul 2>&1
if errorlevel 1 (
  echo No active Wrangler session. Starting login flow...
  npx wrangler login || goto :fail
)
npx wrangler whoami || goto :fail

echo [4/7] Verifying Supabase auth...
npx supabase --version || goto :fail
npx supabase projects list >nul 2>&1
if errorlevel 1 (
  echo No active Supabase session. Starting login flow...
  npx supabase login || goto :fail
)
npx supabase projects list || goto :fail

echo [5/7] Checking Supabase project link...
if exist supabase\.temp\project-ref (
  echo Existing linked project:
  type supabase\.temp\project-ref
) else (
  echo Project is not linked yet. Run:
  echo   npx supabase link --project-ref jgmivviwockcwjkvpqra
)

echo [6/7] Checking Cloudflare resources visibility...
echo Run manually and verify expected resources:
echo   npx wrangler r2 bucket list
echo   npx wrangler queues list
echo   npx wrangler pages project list

echo [7/7] Bootstrap complete.
popd
exit /b 0

:fail
echo ERROR: Bootstrap failed.
popd
exit /b 1

