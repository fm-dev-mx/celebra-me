-- Order lifecycle: event date, payment ledger and settlement.
-- Additive: a new nullable column, a new service-role-only table and function, and a replacement
-- of register_commercial_deposit_purchase that keeps its signature, privileges and Purchase event
-- (total value on the deposit) while also writing the deposit into the ledger and moving an order
-- whose deposit covers the whole total straight to paid.
-- The new ledger, its initial privileges and the new payment function come first, right
-- after begin, so the migration risk guard can prove that each revoke initialises an object created
-- in this same transaction. The table is created without if not exists: a pre-existing table would
-- make that revoke destructive, so the migration fails instead of revoking its grants.
begin;

create table public.sales_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'installment', 'settlement')),
  amount numeric(12, 2) not null check (amount > 0),
  paid_at timestamptz not null,
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 160),
  recorded_by uuid null,
  created_at timestamptz not null default now()
);

revoke all on table public.sales_order_payments from public, anon, authenticated, service_role;
alter table public.sales_order_payments enable row level security;
alter table public.sales_order_payments force row level security;

-- Registers an installment or the settlement of an order that already holds its deposit. The
-- payment that covers the balance is the settlement and moves the order to paid. It never
-- creates a Meta event: the Purchase was sent with the deposit.
create or replace function public.register_commercial_order_payment(
  p_order_id uuid,
  p_amount numeric,
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
  v_payment public.sales_order_payments%rowtype;
  v_key text := nullif(trim(p_idempotency_key), '');
  v_kind text;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'El monto del pago debe ser mayor a cero.';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception using errcode = '22023', message = 'La clave de idempotencia del pago es obligatoria.';
  end if;

  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró la orden de venta.';
  end if;

  select * into v_payment from public.sales_order_payments where idempotency_key = v_key;
  if found then
    if v_payment.order_id <> p_order_id or v_payment.amount <> p_amount then
      raise exception using errcode = '40001', message = 'La clave de idempotencia ya se usó con datos diferentes.';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order), 'payment', to_jsonb(v_payment), 'idempotent', true);
  end if;

  if v_order.status <> 'deposit_paid' then
    raise exception using errcode = '22023',
      message = format('No se puede registrar un pago en una orden con estado "%s".', v_order.status);
  end if;
  if p_amount > v_order.total_amount - v_order.amount_paid then
    raise exception using errcode = '22023', message = 'El pago no puede superar el saldo pendiente de la orden.';
  end if;

  v_kind := case when v_order.amount_paid + p_amount >= v_order.total_amount then 'settlement' else 'installment' end;

  insert into public.sales_order_payments (order_id, kind, amount, paid_at, idempotency_key, recorded_by)
  values (p_order_id, v_kind, p_amount, v_paid_at, v_key, p_actor_id)
  returning * into v_payment;

  update public.sales_orders
  set amount_paid = amount_paid + p_amount,
      status = case when v_kind = 'settlement' then 'paid' else status end,
      paid_at = case when v_kind = 'settlement' then v_paid_at else paid_at end
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order), 'payment', to_jsonb(v_payment), 'idempotent', false);
end;
$$;

revoke all on function public.register_commercial_order_payment(uuid, numeric, uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.register_commercial_order_payment(uuid, numeric, uuid, timestamptz, text)
  to service_role;

grant select on table public.sales_order_payments to service_role;

create index if not exists sales_order_payments_order_idx
  on public.sales_order_payments (order_id, paid_at);

-- At most one deposit and one settlement per order.
create unique index if not exists sales_order_payments_one_deposit_uidx
  on public.sales_order_payments (order_id) where kind = 'deposit';
create unique index if not exists sales_order_payments_one_settlement_uidx
  on public.sales_order_payments (order_id) where kind = 'settlement';

alter table public.sales_orders
  add column if not exists event_date date null;

comment on column public.sales_orders.event_date is
  'Date of the celebration the order is for. A fact about the order, not a lifecycle stage.';

-- Backfill: every order that already holds a deposit gets its single deposit ledger row.
insert into public.sales_order_payments (order_id, kind, amount, paid_at, idempotency_key, recorded_by)
select o.id, 'deposit', o.amount_paid, coalesce(o.deposit_paid_at, o.created_at),
       'backfill-deposit:' || o.id::text, o.deposit_recorded_by
from public.sales_orders o
where o.status in ('deposit_paid', 'paid') and o.amount_paid > 0
on conflict do nothing;

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
  v_paid_at timestamptz;
  v_reward numeric(12, 2) := 0;
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
    if v_order.deposit_idempotency_key is distinct from v_key
       or not exists (
         select 1 from public.sales_order_payments
         where order_id = p_order_id and kind = 'deposit' and amount = p_amount_paid
       ) then
      raise exception using errcode = '40001', message = 'La orden ya tiene un anticipo registrado con datos diferentes.';
    end if;
    if v_order.is_past_sale then
      return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', null, 'idempotent', true);
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

  v_paid_at := case
    when v_order.is_past_sale then coalesce(v_order.sold_at, p_paid_at, now())
    else coalesce(p_paid_at, now())
  end;
  if not v_order.is_past_sale
     and v_order.referred_by_customer_id is not null
     and v_order.referred_by_customer_id <> v_order.customer_id
     and v_order.referrer_credit_awarded = 0 then
    v_reward := 200;
  end if;

  update public.sales_orders
  set status = case when p_amount_paid >= total_amount then 'paid' else 'deposit_paid' end,
      amount_paid = p_amount_paid,
      deposit_paid_at = v_paid_at,
      paid_at = case when p_amount_paid >= total_amount then v_paid_at else paid_at end,
      deposit_idempotency_key = v_key,
      deposit_recorded_by = p_actor_id,
      referrer_credit_awarded = case when v_reward > 0 then v_reward else referrer_credit_awarded end
  where id = p_order_id
  returning * into v_order;

  insert into public.sales_order_payments (order_id, kind, amount, paid_at, idempotency_key, recorded_by)
  values (p_order_id, 'deposit', p_amount_paid, v_paid_at, 'deposit:' || v_key, p_actor_id);

  if v_reward > 0 then
    update public.customers
    set referral_credit_mxn = referral_credit_mxn + v_reward
    where id = v_order.referred_by_customer_id;
  end if;

  if v_order.is_past_sale then
    return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', null, 'idempotent', false);
  end if;

  insert into public.meta_conversion_events (
    order_id, lead_id, customer_id, event_name, event_id,
    trigger_status, value, currency, status
  ) values (
    v_order.id, v_order.lead_id, v_order.customer_id, 'Purchase', v_event_id,
    'deposit_paid', v_order.total_amount, 'MXN', 'pending'
  )
  on conflict (event_id) do nothing
  returning * into v_conversion;

  if v_conversion.id is null then
    select * into v_conversion
    from public.meta_conversion_events
    where event_id = v_event_id;
    if v_conversion.order_id <> v_order.id
      or v_conversion.value <> v_order.total_amount
      or v_conversion.currency <> 'MXN' then
      raise exception using errcode = '40001', message = 'El evento Purchase existente no coincide con el anticipo.';
    end if;
  end if;

  return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', to_jsonb(v_conversion), 'idempotent', false);
end;
$$;

commit;
