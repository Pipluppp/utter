# Files — Password Forgot & Reset

## New files

| File | Purpose |
|------|---------|
| `frontend/src/pages/ForgotPassword.tsx` | Forgot password page (email + captcha form) |
| `frontend/src/pages/account/UpdatePassword.tsx` | Update password page (post-recovery) |
| `frontend/src/pages/account/ChangePasswordSection.tsx` | Change password section on profile page |
| `frontend/src/lib/validation.ts` | Shared password validation helpers |
| `supabase/templates/recovery.html` | Local dev recovery email template |

## Modified files

| File | Change |
|------|--------|
| `workers/api/src/routes/auth.ts` | Added `forgot-password` and `update-password` endpoints, callback reads `next` param |
| `workers/api/src/_shared/auth_session.ts` | Added `serializeIdentities()` helper |
| `frontend/src/lib/auth.ts` | Added `forgotPassword()`, `updatePassword()`, extended `AuthSessionResponse` with `identities` |
| `frontend/src/app/router.tsx` | Registered `/auth/forgot-password` and `/account/update-password` routes |
| `frontend/src/pages/Auth.tsx` | Added "Forgot password?" link |
| `frontend/src/pages/account/Profile.tsx` | Integrated `ChangePasswordSection`, OAuth-only detection |
| `frontend/src/pages/account/accountData.ts` | Extended account data types for identities |
| `frontend/vite.config.ts` | Added forwarded headers to dev proxy |
| `supabase/config.toml` | Added recovery email template config for local dev |
