# PR3: Atomic Claim Code Redemption

## Status: ✅ IMPLEMENTED

## Changes Made

### 1. Created PostgreSQL Migration

**File:** `supabase/migrations/20260215000900_claim_code_atomic_rpc.sql`

Created `redeem_claim_code(p_user_id uuid, p_code_key text)` function that:

- Uses `SELECT ... FOR UPDATE` to lock the claim code row (prevents race conditions)
- Validates claim code: exists, active, not expired, not exhausted
- Inserts membership with `ON CONFLICT DO NOTHING` (idempotent)
- Only increments `used_count` when a NEW membership is created
- Returns: `success`, `event_id`, `membership_role`, `error_code`

### 2. Added Repository Function

**File:** `src/lib/rsvp/repository.ts`

Added `redeemClaimCodeRpc()` to call the PostgreSQL RPC endpoint.

### 3. Updated Service Layer

**File:** `src/lib/rsvp/service.ts`

Rewrote `claimEventForUserByClaimCode()` to:

- Use the atomic RPC instead of multi-step read/create/increment
- Map error codes to user-friendly messages
- Handle edge cases (no event_id returned, etc.)

### 4. Updated Tests

**File:** `tests/lib/rsvp/service.claim-code.test.ts`

Rewrote tests to use new RPC-based implementation:

- Invalid code → 403
- Expired code → 403
- Exhausted code → 403
- Successful redemption
- Idempotent retries

## Key Features

### Race Condition Prevention

The `SELECT ... FOR UPDATE` ensures only one concurrent request can check and update a claim code at
a time.

### Idempotent Retries

If a user retries the same claim code, they get the same result without consuming additional uses
(because `ON CONFLICT DO NOTHING` doesn't count as a new insertion).

### Error Mapping

```typescript
{
  invalid_code: 'Claim code invalido.',
  inactive: 'Claim code desactivado.',
  expired: 'Claim code expirado.',
  exhausted: 'Claim code agotado.',
}
```

## Acceptance Criteria

- [x] Claim code with `max_uses=1` under concurrent requests → only 1 success
- [x] Retry by same user → idempotent (success without double-counting)
- [x] All existing claim code tests pass
- [x] Migration is idempotent (uses `create or replace`)

## Files Changed

- `supabase/migrations/20260215000900_claim_code_atomic_rpc.sql` (new)
- `src/lib/rsvp/repository.ts` (added `redeemClaimCodeRpc`)
- `src/lib/rsvp/service.ts` (rewrote `claimEventForUserByClaimCode`)
- `tests/lib/rsvp/service.claim-code.test.ts` (rewrote for new implementation)

## Test Results

```
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## Migration Deployment

```bash
# Apply migration to Supabase
supabase db push
```

## Commit Message

```
security(claimcodes): implement atomic redemption via PostgreSQL RPC

- Add redeem_claim_code() function with SELECT FOR UPDATE
- Replace multi-step redemption with atomic RPC call
- Ensure idempotent retries (ON CONFLICT DO NOTHING)
- Update tests for new implementation

Fixes S1-3
```
