# PR1: Close Admin Route Gaps

## Status: ✅ IMPLEMENTED

## Changes Made

### 1. Updated `src/middleware.ts`

- Added `/dashboard/eventos` to `ADMIN_ONLY_PATHS` array
- Line 12:
  `const ADMIN_ONLY_PATHS = ['/dashboard/admin', '/dashboard/usuarios', '/dashboard/claimcodes', '/dashboard/eventos'];`

### 2. Updated `tests/integration/auth.middleware.test.ts`

- Added regression test: `host_client` accessing `/dashboard/eventos` → redirect to
  `/dashboard/invitados`
- Added positive test: `super_admin` with MFA can access `/dashboard/eventos`

## Acceptance Criteria

- [x] `host_client` visiting `/dashboard/eventos` → redirected to `/dashboard/invitados`
- [x] `super_admin` with MFA visiting `/dashboard/eventos` → allowed

## Files Changed

- `src/middleware.ts` (1 line changed)
- `tests/integration/auth.middleware.test.ts` (40 lines added)

## Test Results

```bash
npm test -- tests/integration/auth.middleware.test.ts
```

## Commit Message

```
security(middleware): add /dashboard/eventos to ADMIN_ONLY_PATHS

Ensure /dashboard/eventos route is protected for admin-only access.
host_client users are now redirected to /dashboard/invitados.

Fixes S1-1
```
