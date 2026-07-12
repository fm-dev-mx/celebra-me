-- Commercial CRM and Meta CAPI production-readiness hardening.
-- Additive only: no existing commercial records are rewritten or classified.

begin;

alter table public.sales_orders
  add column if not exists idempotency_key text null,
  add column if not exists deposit_idempotency_key text null,
  add column if not exists deposit_recorded_by uuid null;

create unique index if not exists idx_sales_orders_idempotency_key_unique
  on public.sales_orders (idempotency_key)
  where idempotency_key is not null;

alter table public.meta_conversion_events
  add column if not exists claimed_at timestamptz null,
  add column if not exists claim_expires_at timestamptz null,
  add column if not exists claim_id uuid null,
  add column if not exists provider_events_received integer null,
  add column if not exists provider_trace_id text null,
  add column if not exists provider_message text null,
  add column if not exists delivery_ambiguous_at timestamptz null;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_status_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'ambiguous'));

create index if not exists idx_meta_conversion_events_expired_claims
  on public.meta_conversion_events (claim_expires_at)
  where status = 'sending';

create table if not exists public.meta_conversion_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  conversion_event_id uuid not null references public.meta_conversion_events(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  claim_id uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  outcome text null check (outcome is null or outcome in (
    'sent', 'failed', 'skipped', 'ambiguous'
  )),
  error_code text null,
  error_message text null,
  provider_events_received integer null,
  provider_trace_id text null,
  provider_message text null,
  recovery_origin text null,
  created_at timestamptz not null default now(),
  unique (conversion_event_id, attempt_number),
  unique (claim_id)
);

create index if not exists idx_meta_conversion_attempts_event_started
  on public.meta_conversion_delivery_attempts (conversion_event_id, started_at desc);

create table if not exists public.meta_conversion_recoveries (
  id uuid primary key default gen_random_uuid(),
  conversion_event_id uuid not null references public.meta_conversion_events(id) on delete cascade,
  actor_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  source_status text not null,
  destination_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_meta_conversion_recoveries_event_created
  on public.meta_conversion_recoveries (conversion_event_id, created_at desc);

create table if not exists public.commercial_record_classifications (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('lead', 'customer', 'sales_order', 'meta_conversion_event')),
  record_id uuid not null,
  classification text not null check (classification = 'test_qa'),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  classified_by uuid not null,
  classified_at timestamptz not null default now(),
  revoked_by uuid null,
  revoked_at timestamptz null,
  revocation_reason text null,
  created_at timestamptz not null default now(),
  check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or
    (revoked_at is not null and revoked_by is not null and char_length(trim(revocation_reason)) between 3 and 500)
  )
);

create unique index if not exists idx_commercial_classifications_active_unique
  on public.commercial_record_classifications (record_type, record_id, classification)
  where revoked_at is null;

create index if not exists idx_commercial_classifications_record
  on public.commercial_record_classifications (record_type, record_id, classified_at desc);

alter table public.meta_conversion_delivery_attempts enable row level security;
alter table public.meta_conversion_delivery_attempts force row level security;
alter table public.meta_conversion_recoveries enable row level security;
alter table public.meta_conversion_recoveries force row level security;
alter table public.commercial_record_classifications enable row level security;
alter table public.commercial_record_classifications force row level security;

create policy meta_conversion_delivery_attempts_service_role_full_access
  on public.meta_conversion_delivery_attempts for all to service_role
  using (true) with check (true);
create policy meta_conversion_recoveries_service_role_full_access
  on public.meta_conversion_recoveries for all to service_role
  using (true) with check (true);
create policy commercial_record_classifications_service_role_full_access
  on public.commercial_record_classifications for all to service_role
  using (true) with check (true);

grant select, insert, update on public.meta_conversion_delivery_attempts to service_role;
grant select, insert on public.meta_conversion_recoveries to service_role;
grant select, insert, update on public.commercial_record_classifications to service_role;

create or replace function public.guard_meta_conversion_attempt_update()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  if old.completed_at is not null then
    raise exception using errcode = '55000', message = 'Completed CAPI attempts are immutable.';
  end if;
  if new.conversion_event_id <> old.conversion_event_id
    or new.attempt_number <> old.attempt_number
    or new.claim_id <> old.claim_id
    or new.started_at <> old.started_at then
    raise exception using errcode = '55000', message = 'CAPI attempt identity is immutable.';
  end if;
  if new.completed_at is null or new.outcome is null then
    raise exception using errcode = '55000', message = 'CAPI attempt completion must be final.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_meta_conversion_attempts_immutable on public.meta_conversion_delivery_attempts;
create trigger trg_meta_conversion_attempts_immutable
  before update on public.meta_conversion_delivery_attempts
  for each row execute function public.guard_meta_conversion_attempt_update();

create or replace function public.register_commercial_deposit_purchase(
  p_order_id uuid,
  p_amount_paid numeric,
  p_actor_id uuid,
  p_paid_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_order public.sales_orders%rowtype;
  v_conversion public.meta_conversion_events%rowtype;
  v_event_id text;
  v_key text := nullif(trim(p_idempotency_key), '');
begin
  if p_amount_paid is null or p_amount_paid <= 0 then
    raise exception using errcode = '22023', message = 'El monto del anticipo debe ser mayor a cero.';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception using errcode = '22023', message = 'La clave de idempotencia del anticipo es obligatoria.';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró la orden de venta.';
  end if;
  if p_amount_paid > v_order.total_amount then
    raise exception using errcode = '22023', message = 'El anticipo no puede ser mayor que el monto total de la orden.';
  end if;

  v_event_id := 'purchase:' || p_order_id::text || ':deposit_paid';

  if v_order.status in ('deposit_paid', 'paid') then
    if v_order.amount_paid <> p_amount_paid or v_order.deposit_idempotency_key is distinct from v_key then
      raise exception using errcode = '40001', message = 'La orden ya tiene un anticipo registrado con datos diferentes.';
    end if;
    select * into v_conversion
    from public.meta_conversion_events
    where event_id = v_event_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La orden pagada no tiene su evento Purchase asociado.';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', to_jsonb(v_conversion), 'idempotent', true);
  end if;

  if v_order.status not in ('quoted', 'confirmed') then
    raise exception using errcode = '22023', message = format('No se puede registrar un anticipo en una orden con estado "%s".', v_order.status);
  end if;

  update public.sales_orders
  set status = 'deposit_paid',
      amount_paid = p_amount_paid,
      deposit_paid_at = coalesce(p_paid_at, now()),
      deposit_idempotency_key = v_key,
      deposit_recorded_by = p_actor_id
  where id = p_order_id
  returning * into v_order;

  insert into public.meta_conversion_events (
    order_id, lead_id, customer_id, event_name, event_id,
    trigger_status, value, currency, status
  ) values (
    v_order.id, v_order.lead_id, v_order.customer_id, 'Purchase', v_event_id,
    'deposit_paid', p_amount_paid, 'MXN', 'pending'
  )
  on conflict (event_id) do nothing
  returning * into v_conversion;

  if v_conversion.id is null then
    select * into v_conversion
    from public.meta_conversion_events
    where event_id = v_event_id;
    if v_conversion.order_id <> v_order.id
      or v_conversion.value <> p_amount_paid
      or v_conversion.currency <> 'MXN' then
      raise exception using errcode = '40001', message = 'El evento Purchase existente no coincide con el anticipo.';
    end if;
  end if;

  return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', to_jsonb(v_conversion), 'idempotent', false);
end;
$$;

create or replace function public.claim_meta_conversion_event(
  p_event_id uuid,
  p_claim_id uuid,
  p_now timestamptz default now(),
  p_lease_seconds integer default 120
)
returns setof public.meta_conversion_events
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_event public.meta_conversion_events%rowtype;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'Invalid CAPI claim lease.';
  end if;

  select * into v_event
  from public.meta_conversion_events
  where id = p_event_id
  for update skip locked;

  if not found
    or v_event.status not in ('pending', 'failed')
    or (v_event.next_attempt_at is not null and v_event.next_attempt_at > p_now) then
    return;
  end if;

  update public.meta_conversion_events
  set status = 'sending',
      attempt_count = attempt_count + 1,
      claimed_at = p_now,
      claim_expires_at = p_now + make_interval(secs => p_lease_seconds),
      claim_id = p_claim_id,
      updated_at = p_now
  where id = p_event_id
  returning * into v_event;

  insert into public.meta_conversion_delivery_attempts (
    conversion_event_id, attempt_number, claim_id, started_at
  ) values (
    v_event.id, v_event.attempt_count, p_claim_id, p_now
  );

  return next v_event;
end;
$$;

create or replace function public.recover_meta_conversion_event(
  p_event_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_now timestamptz default now()
)
returns setof public.meta_conversion_events
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_event public.meta_conversion_events%rowtype;
  v_reason text := trim(p_reason);
begin
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'La razón de recuperación es obligatoria.';
  end if;

  select * into v_event
  from public.meta_conversion_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró el evento de conversión.';
  end if;

  if not (
    v_event.status = 'failed'
    or v_event.status = 'ambiguous'
    or (
      v_event.status = 'sending'
      and (v_event.claim_expires_at <= p_now or v_event.claim_expires_at is null)
    )
    or (v_event.status = 'skipped' and v_event.last_error_code in ('DELIVERY_DISABLED', 'CONFIG_ERROR'))
  ) then
    raise exception using errcode = '40001', message = format('El evento en estado "%s" no se puede recuperar.', v_event.status);
  end if;

  if v_event.status = 'sending' then
    update public.meta_conversion_delivery_attempts
    set completed_at = p_now,
        outcome = 'ambiguous',
        error_code = 'STALE_CLAIM_RECOVERED',
        error_message = 'El reclamo venció antes de confirmar la entrega.',
        recovery_origin = 'manual_stale_claim'
    where conversion_event_id = v_event.id
      and claim_id = v_event.claim_id
      and completed_at is null;
  end if;

  insert into public.meta_conversion_recoveries (
    conversion_event_id, actor_id, reason, source_status, destination_status
  ) values (
    v_event.id,
    p_actor_id,
    v_reason,
    case
      when v_event.status = 'sending' and v_event.claim_expires_at is null
        then 'sending_legacy_no_lease'
      else v_event.status
    end,
    'pending'
  );

  update public.meta_conversion_events
  set status = 'pending',
      next_attempt_at = null,
      claimed_at = null,
      claim_expires_at = null,
      claim_id = null,
      updated_at = p_now
  where id = v_event.id
  returning * into v_event;

  return next v_event;
end;
$$;

create or replace function public.finalize_meta_conversion_event(
  p_event_id uuid,
  p_claim_id uuid,
  p_status text,
  p_now timestamptz default now(),
  p_payload_hash text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_next_attempt_at timestamptz default null,
  p_provider_events_received integer default null,
  p_provider_trace_id text default null,
  p_provider_message text default null
)
returns setof public.meta_conversion_events
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_event public.meta_conversion_events%rowtype;
begin
  if p_claim_id is null then
    raise exception using errcode = '22023', message = 'CAPI claim id is required.';
  end if;
  if p_status not in ('sent', 'failed', 'skipped', 'ambiguous') then
    raise exception using errcode = '22023', message = 'Invalid CAPI completion status.';
  end if;

  update public.meta_conversion_events
  set status = p_status,
      sent_at = case when p_status = 'sent' then p_now else sent_at end,
      delivery_ambiguous_at = case when p_status = 'ambiguous' then p_now else delivery_ambiguous_at end,
      payload_hash = coalesce(p_payload_hash, payload_hash),
      provider_events_received = p_provider_events_received,
      provider_trace_id = p_provider_trace_id,
      provider_message = p_provider_message,
      last_error_code = case when p_status = 'sent' then null else p_error_code end,
      last_error_message = case when p_status = 'sent' then null else p_error_message end,
      next_attempt_at = case when p_status = 'failed' then p_next_attempt_at else null end,
      claimed_at = null,
      claim_expires_at = null,
      claim_id = null,
      updated_at = p_now
  where id = p_event_id
    and status = 'sending'
    and claim_id = p_claim_id
  returning * into v_event;

  if not found then
    return;
  end if;

  update public.meta_conversion_delivery_attempts
  set completed_at = p_now,
      outcome = p_status,
      error_code = p_error_code,
      error_message = p_error_message,
      provider_events_received = p_provider_events_received,
      provider_trace_id = p_provider_trace_id,
      provider_message = p_provider_message
  where conversion_event_id = p_event_id
    and claim_id = p_claim_id
    and completed_at is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'CAPI claim attempt is missing or already finalized.';
  end if;

  return next v_event;
end;
$$;

revoke all on function public.register_commercial_deposit_purchase(uuid, numeric, uuid, timestamptz, text) from public;
revoke all on function public.claim_meta_conversion_event(uuid, uuid, timestamptz, integer) from public;
revoke all on function public.recover_meta_conversion_event(uuid, uuid, text, timestamptz) from public;
revoke all on function public.finalize_meta_conversion_event(uuid, uuid, text, timestamptz, text, text, text, timestamptz, integer, text, text) from public;
grant execute on function public.register_commercial_deposit_purchase(uuid, numeric, uuid, timestamptz, text) to service_role;
grant execute on function public.claim_meta_conversion_event(uuid, uuid, timestamptz, integer) to service_role;
grant execute on function public.recover_meta_conversion_event(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.finalize_meta_conversion_event(uuid, uuid, text, timestamptz, text, text, text, timestamptz, integer, text, text) to service_role;

comment on table public.meta_conversion_delivery_attempts is
  'Immutable per-attempt CAPI delivery history without customer identity or request payloads.';
comment on table public.meta_conversion_recoveries is
  'Auditable manual recovery history for state-safe CAPI queue transitions.';
comment on table public.commercial_record_classifications is
  'Reversible owner-reviewed classification of commercial records as test/QA evidence.';

commit;
