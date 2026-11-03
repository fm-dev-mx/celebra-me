-- Past clients, referral codes, referral rewards and net discounted Purchase values.
-- Spec: docs/domains/tracking/commercial-attribution.md (Past sales, referrals and customer list)
--
-- 1. Customers carry a unique referral code (for example ANA24), optional city/country for the
--    Meta Customer List CSV export, an is_past_client flag and an accumulative referral_credit_mxn
--    balance ($200 MXN per confirmed friend order).
-- 2. Leads and sales orders carry is_past_sale (past sales never enqueue Meta Lead, Purchase or
--    CRM stage events), referral_code_used, referred_by_customer_id and referrer_external_id.
-- 3. Sales orders also record sold_at (real historical sale date for past sales), discount_amount
--    (10% friend discount or redeemed referrer credit; total_amount stores the net price) and
--    referrer_credit_awarded (amount credited to the referring customer once paid) and
--    referrer_credit_redeemed (the customer's own referral credit spent on this order).
-- 4. register_commercial_deposit_purchase skips the meta_conversion_events insert when the locked
--    order has is_past_sale = true (returning conversion_event: null) and awards $200 MXN to the
--    referring customer idempotently on the first deposit transition of a referred order that is
--    not a past sale.
-- 5. redeem_customer_referral_credit atomically spends a customer's referral credit; the order
--    service calls it once, after inserting the order that carries the redeemed amount.
--
-- Additive expand migration: new functions are initialized (revoke) at the start of the
-- transaction before any non-initialization statement, existing rows are backfilled with unique
-- referral codes, and no existing constraint or column is dropped.

begin;

create function public.generate_customer_referral_code(p_display_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_clean text;
  v_prefix text;
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_suffix text;
  v_code text;
  v_attempt integer := 0;
begin
  v_clean := pg_catalog.upper(
    pg_catalog.regexp_replace(
      pg_catalog.translate(
        coalesce(p_display_name, ''),
        'áéíóúàèìòùäëïöüâêîôûñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑ',
        'aeiouaeiouaeiouaeiounAEIOUAEIOUAEIOUAEIOUN'
      ),
      '[^A-Za-z]',
      '',
      'g'
    )
  );
  if pg_catalog.length(v_clean) < 3 then
    v_prefix := pg_catalog.rpad(coalesce(nullif(v_clean, ''), 'CLB'), 3, 'X');
  else
    v_prefix := pg_catalog.substr(v_clean, 1, 4);
  end if;

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 100 then
      raise exception 'customer referral_code space exhausted'
        using errcode = 'P0001';
    end if;
    v_bytes := extensions.gen_random_bytes(3);
    if v_attempt <= 25 then
      v_suffix := pg_catalog.lpad(
        ((pg_catalog.get_byte(v_bytes, 0) % 90) + 10)::text,
        2,
        '0'
      );
    else
      v_suffix :=
        pg_catalog.substr(v_alphabet, (pg_catalog.get_byte(v_bytes, 0) % pg_catalog.length(v_alphabet)) + 1, 1) ||
        pg_catalog.substr(v_alphabet, (pg_catalog.get_byte(v_bytes, 1) % pg_catalog.length(v_alphabet)) + 1, 1) ||
        pg_catalog.substr(v_alphabet, (pg_catalog.get_byte(v_bytes, 2) % pg_catalog.length(v_alphabet)) + 1, 1);
    end if;
    v_code := v_prefix || v_suffix;
    exit when not exists (
      select 1
      from public.customers c
      where c.referral_code = v_code
    );
  end loop;
  return v_code;
end;
$function$;

revoke all on function public.generate_customer_referral_code(text) from public, anon, authenticated, service_role;

create function public.customers_assign_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.referral_code is null or pg_catalog.btrim(new.referral_code) = '' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('customer_referral_code', 0)
    );
    new.referral_code := public.generate_customer_referral_code(new.display_name);
  else
    new.referral_code := pg_catalog.upper(pg_catalog.btrim(new.referral_code));
  end if;
  return new;
end;
$function$;

revoke all on function public.customers_assign_referral_code() from public, anon, authenticated, service_role;

create function public.redeem_customer_referral_credit(
  p_customer_id uuid,
  p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer;
begin
  if p_amount is null or p_amount <= 0 then
    return false;
  end if;
  update public.customers
  set referral_credit_mxn = referral_credit_mxn - p_amount,
      updated_at = pg_catalog.now()
  where id = p_customer_id
    and referral_credit_mxn >= p_amount;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

revoke all on function public.redeem_customer_referral_credit(uuid, numeric) from public, anon, authenticated, service_role;

comment on function public.generate_customer_referral_code(text) is
  'Generates a unique uppercase referral code (e.g. ANA24) from the customer display name.';

alter table public.customers
  add column if not exists referral_code text null
    check (referral_code is null or referral_code ~ '^[A-Z0-9]{4,16}$'),
  add column if not exists city text null
    check (city is null or char_length(city) between 1 and 120),
  add column if not exists country text not null default 'MX'
    check (country ~ '^[A-Z]{2}$'),
  add column if not exists is_past_client boolean not null default false,
  add column if not exists referral_credit_mxn numeric(12, 2) not null default 0
    check (referral_credit_mxn >= 0);

create unique index if not exists idx_customers_referral_code_unique
  on public.customers (referral_code)
  where referral_code is not null;

create trigger trg_customers_assign_referral_code
  before insert on public.customers
  for each row
  execute function public.customers_assign_referral_code();

update public.customers c
set referral_code = public.generate_customer_referral_code(c.display_name)
from (
  select id
  from public.customers
  where referral_code is null
  order by created_at, id
) pending
where c.id = pending.id;

alter table public.customers
  alter column referral_code set not null;

comment on column public.customers.referral_code is
  'Unique referral code shared as https://www.celebra-me.com/?ref=<code>.';
comment on column public.customers.city is
  'Optional city for Meta Customer List CSV exports.';
comment on column public.customers.country is
  'ISO 3166-1 alpha-2 country code (default MX) for Meta Customer List CSV exports.';
comment on column public.customers.is_past_client is
  'True when registered from a historical past sale (venta anterior).';
comment on column public.customers.referral_credit_mxn is
  'Accumulated MXN discount credit earned from confirmed friend referrals ($200 MXN each).';

alter table public.leads
  add column if not exists is_past_sale boolean not null default false,
  add column if not exists referred_by_customer_id uuid null
    references public.customers(id) on delete set null,
  add column if not exists referral_code_used text null
    check (referral_code_used is null or referral_code_used ~ '^[A-Z0-9]{4,16}$'),
  add column if not exists referrer_external_id text null
    check (referrer_external_id is null or char_length(referrer_external_id) between 1 and 128);

create index if not exists idx_leads_referred_by_customer_id
  on public.leads (referred_by_customer_id)
  where referred_by_customer_id is not null;

comment on column public.leads.is_past_sale is
  'True when the lead represents a historical past sale and never sends Meta CAPI events.';
comment on column public.leads.referred_by_customer_id is
  'First referring customer who brought this lead before any confirmed sale.';
comment on column public.leads.referral_code_used is
  'Referral code captured from ?ref=CODE on the visit or CRM intake.';
comment on column public.leads.referrer_external_id is
  'SHA-256 external_id of the referring customer, tying the referral in CAPI without replacing the friend visitor_id.';

alter table public.sales_orders
  add column if not exists is_past_sale boolean not null default false,
  add column if not exists sold_at timestamptz null,
  add column if not exists referred_by_customer_id uuid null
    references public.customers(id) on delete set null,
  add column if not exists referral_code_used text null
    check (referral_code_used is null or referral_code_used ~ '^[A-Z0-9]{4,16}$'),
  add column if not exists discount_amount numeric(12, 2) not null default 0
    check (discount_amount >= 0),
  add column if not exists referrer_credit_awarded numeric(12, 2) not null default 0
    check (referrer_credit_awarded >= 0),
  add column if not exists referrer_credit_redeemed numeric(12, 2) not null default 0
    check (referrer_credit_redeemed >= 0);

create index if not exists idx_sales_orders_referred_by_customer_id
  on public.sales_orders (referred_by_customer_id)
  where referred_by_customer_id is not null;

comment on column public.sales_orders.is_past_sale is
  'True when the order is a historical past sale (venta anterior). Never triggers Meta Purchase or CRM stage events.';
comment on column public.sales_orders.sold_at is
  'Historical sale timestamp for a past sale.';
comment on column public.sales_orders.referred_by_customer_id is
  'Referring customer who earned the $200 MXN credit when this order was confirmed/paid.';
comment on column public.sales_orders.referral_code_used is
  'Referral code applied to this order for the 10% friend discount.';
comment on column public.sales_orders.discount_amount is
  'Discount in MXN already subtracted from total_amount (10% friend referral discount or redeemed credit).';
comment on column public.sales_orders.referrer_credit_awarded is
  'MXN credit awarded to referred_by_customer_id upon payment confirmation ($200 MXN).';
comment on column public.sales_orders.referrer_credit_redeemed is
  'MXN of the customer''s own referral credit spent on this order (included in discount_amount).';

grant execute on function public.redeem_customer_referral_credit(uuid, numeric) to service_role;

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
    if v_order.amount_paid <> p_amount_paid or v_order.deposit_idempotency_key is distinct from v_key then
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
  set status = 'deposit_paid',
      amount_paid = p_amount_paid,
      deposit_paid_at = v_paid_at,
      deposit_idempotency_key = v_key,
      deposit_recorded_by = p_actor_id,
      referrer_credit_awarded = case when v_reward > 0 then v_reward else referrer_credit_awarded end
  where id = p_order_id
  returning * into v_order;

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
