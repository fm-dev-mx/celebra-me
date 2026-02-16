begin;

-- Atomic claim code redemption function
-- Prevents race conditions by using SELECT FOR UPDATE
-- Only increments used_count when membership is actually created (idempotent)
drop function if exists public.redeem_claim_code(uuid, text);

create or replace function public.redeem_claim_code(
  p_user_id uuid,
  p_code_key text
) returns table (
  r_success boolean,
  r_event_id uuid,
  r_membership_role text,
  r_error_code text
) as $$
declare
  v_claim record;
  v_membership_inserted boolean := false;
begin
  -- Lock claim code row to prevent concurrent modifications
  select ecc.* into v_claim
  from public.event_claim_codes ecc
  where ecc.code_key = p_code_key
  for update;

  if not found then
    return query select false, null::uuid, null::text, 'invalid_code'::text;
    return;
  end if;

  if not v_claim.active then
    return query select false, null::uuid, null::text, 'inactive'::text;
    return;
  end if;

  if v_claim.expires_at is not null and v_claim.expires_at < now() then
    return query select false, null::uuid, null::text, 'expired'::text;
    return;
  end if;

  if v_claim.used_count >= v_claim.max_uses then
    return query select false, null::uuid, null::text, 'exhausted'::text;
    return;
  end if;

  -- Try to insert membership (idempotent - won't fail if already exists)
  insert into public.event_memberships (event_id, user_id, membership_role)
  values (v_claim.event_id, p_user_id, 'owner')
  on conflict (event_id, user_id) do nothing
  returning true into v_membership_inserted;

  -- Only increment used_count if we actually created a new membership
  -- This makes retries idempotent - they won't consume additional uses
  if v_membership_inserted then
    update public.event_claim_codes
    set used_count = used_count + 1
    where id = v_claim.id;
  end if;

  return query select true, v_claim.event_id, 'owner'::text, null::text;
end;
$$ language plpgsql security definer;

-- Add comment for documentation
comment on function public.redeem_claim_code(uuid, text) is
'Atomically redeems a claim code for a user. Uses row locking to prevent race conditions.
Only increments used_count when a new membership is actually created, making retries idempotent.
Returns: success, event_id, membership_role, error_code (if failed)';

commit;
