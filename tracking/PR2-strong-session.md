# PR2: Strong Admin Session Guard

## Status: ✅ IMPLEMENTED

## Changes Made

### 1. Updated `src/lib/rsvp/authorization.ts`

- Added `REQUIRE_FRESH_MFA_FOR_ADMIN` environment variable support
- Created `requireAdminStrongSession()` function that:
    - Validates role is `super_admin`
    - Checks for MFA evidence via `hasMfaEvidence()`
    - If `REQUIRE_FRESH_MFA_FOR_ADMIN=true`: rejects trusted device tokens
    - If `REQUIRE_FRESH_MFA_FOR_ADMIN=false` (default): accepts trusted device tokens as AAL2
      equivalent
    - Returns 403 with appropriate error messages for each failure case

### 2. Updated Admin API Routes

All admin API endpoints now use `requireAdminStrongSession()` instead of `requireAdminSession()`:

- `src/pages/api/dashboard/admin/events.ts`
- `src/pages/api/dashboard/admin/users.ts`
- `src/pages/api/dashboard/admin/users/[userId]/role.ts`
- `src/pages/api/dashboard/claimcodes.ts`
- `src/pages/api/dashboard/claimcodes/[claimCodeId].ts`
- `src/pages/api/dashboard/claimcodes/validate.ts`

### 3. Added Tests

- Created `tests/api/admin.strong-session.test.ts` with 10 test cases:
    - super_admin + AAL1 → 403
    - super_admin + AAL2 → 200
    - host_client → 403
    - Authorization guard is called for all admin endpoints

## Configuration

### Environment Variable

```bash
# .env.local
# Set to 'true' to require fresh MFA (no trusted device fallback)
REQUIRE_FRESH_MFA_FOR_ADMIN=false
```

### Default Behavior

- **Default (`false`)**: Trusted device tokens are accepted as AAL2 equivalent
- **When `true`**: Only fresh MFA (TOTP, OTP, etc.) is accepted for admin access

## Acceptance Criteria

- [x] `super_admin` with AAL1 → 403 on all admin APIs
- [x] `super_admin` with AAL2 → 200 on all admin APIs
- [x] `host_client` → 403 on all admin APIs
- [x] Config option to disable trusted device fallback works correctly

## Files Changed

- `src/lib/rsvp/authorization.ts` (rewritten with strong session guard)
- `src/pages/api/dashboard/admin/events.ts`
- `src/pages/api/dashboard/admin/users.ts`
- `src/pages/api/dashboard/admin/users/[userId]/role.ts`
- `src/pages/api/dashboard/claimcodes.ts`
- `src/pages/api/dashboard/claimcodes/[claimCodeId].ts`
- `src/pages/api/dashboard/claimcodes/validate.ts`
- `tests/api/admin.strong-session.test.ts` (new, 10 tests)

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## Commit Message

```
security(api): enforce AAL2/MFA on all admin endpoints

- Add requireAdminStrongSession() with MFA + trusted device validation
- Add REQUIRE_FRESH_MFA_FOR_ADMIN config option
- Apply strong session guard to all admin API routes
- Add comprehensive test coverage

Fixes S1-2, S1-4
```
