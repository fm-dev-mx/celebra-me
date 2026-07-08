-- Commercial attribution capture and customer identity foundation.
--
-- This migration is additive. It prepares first-party Meta attribution fields,
-- normalized commercial phone fields, minimal customer identity, manual sales
-- orders, and an outbox for future server-side Meta Purchase delivery.
-- It does not send Meta Purchase events.

begin;

alter table public.visitor_sessions
  add column if not exists fbp text null,
  add column if not exists fbc text null,
  add column if not exists fbclid text null;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text null,
  normalized_email text null,
  phone_country_code text null,
  phone_national text null,
  phone_e164 text null,
  created_from_lead_id uuid null references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists customer_id uuid null references public.customers(id) on delete set null,
  add column if not exists phone_country_code text null,
  add column if not exists phone_national text null,
  add column if not exists phone_e164 text null,
  add column if not exists fbp text null,
  add column if not exists fbc text null,
  add column if not exists fbclid text null;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid null references public.leads(id) on delete set null,
  session_id uuid null references public.visitor_sessions(id) on delete set null,
  source_event_id uuid null references public.tracking_events(id) on delete set null,
  status text not null default 'confirmed'
    check (status in ('draft', 'quoted', 'confirmed', 'deposit_paid', 'paid', 'cancelled', 'lost')),
  event_type text not null,
  package_id text null,
  package_name text null,
  currency text not null default 'MXN' check (currency = 'MXN'),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  deposit_amount numeric(12, 2) null check (deposit_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  confirmed_at timestamptz null,
  deposit_paid_at timestamptz null,
  paid_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_conversion_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  lead_id uuid null references public.leads(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  event_name text not null check (event_name in ('Purchase')),
  event_id text not null unique,
  trigger_status text not null check (trigger_status in ('deposit_paid')),
  value numeric(12, 2) not null check (value >= 0),
  currency text not null default 'MXN',
  payload_hash text null,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text null,
  last_error_message text null,
  next_attempt_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_normalized_email_unique
  on public.customers (normalized_email)
  where normalized_email is not null;

create unique index if not exists idx_customers_phone_e164_unique
  on public.customers (phone_e164)
  where phone_e164 is not null;

create index if not exists idx_leads_customer_id
  on public.leads (customer_id);

create index if not exists idx_leads_phone_e164
  on public.leads (phone_e164)
  where phone_e164 is not null;

create index if not exists idx_leads_email
  on public.leads (email)
  where email is not null;

create index if not exists idx_leads_recent_context
  on public.leads (event_type, package_interest, created_at desc);

create index if not exists idx_visitor_sessions_fbclid
  on public.visitor_sessions (fbclid)
  where fbclid is not null;

create index if not exists idx_sales_orders_customer_created_at
  on public.sales_orders (customer_id, created_at desc);

create index if not exists idx_sales_orders_lead_id
  on public.sales_orders (lead_id)
  where lead_id is not null;

create index if not exists idx_sales_orders_status_created_at
  on public.sales_orders (status, created_at desc);

create index if not exists idx_meta_conversion_events_order_id
  on public.meta_conversion_events (order_id);

create index if not exists idx_meta_conversion_events_status_next_attempt
  on public.meta_conversion_events (status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

drop trigger if exists trg_customers_touch_updated_at on public.customers;
create trigger trg_customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_orders_touch_updated_at on public.sales_orders;
create trigger trg_sales_orders_touch_updated_at
  before update on public.sales_orders
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_meta_conversion_events_touch_updated_at on public.meta_conversion_events;
create trigger trg_meta_conversion_events_touch_updated_at
  before update on public.meta_conversion_events
  for each row execute function public.touch_updated_at();

alter table public.customers enable row level security;
alter table public.customers force row level security;

alter table public.sales_orders enable row level security;
alter table public.sales_orders force row level security;

alter table public.meta_conversion_events enable row level security;
alter table public.meta_conversion_events force row level security;

drop policy if exists customers_service_role_full_access on public.customers;
create policy customers_service_role_full_access
  on public.customers
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists sales_orders_service_role_full_access on public.sales_orders;
create policy sales_orders_service_role_full_access
  on public.sales_orders
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists meta_conversion_events_service_role_full_access
  on public.meta_conversion_events;
create policy meta_conversion_events_service_role_full_access
  on public.meta_conversion_events
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.customers to service_role;
grant select, insert, update, delete on public.sales_orders to service_role;
grant select, insert, update, delete on public.meta_conversion_events to service_role;

comment on column public.visitor_sessions.fbp is
  'Meta browser identifier captured only from eligible commercial acquisition surfaces.';

comment on column public.visitor_sessions.fbc is
  'Meta click identifier captured or derived only from eligible commercial acquisition surfaces.';

comment on column public.visitor_sessions.fbclid is
  'Raw fbclid query value captured only from eligible commercial acquisition surfaces.';

comment on table public.customers is
  'Canonical commercial customer identity, separate from RSVP guests and invitation recipients.';

comment on column public.leads.customer_id is
  'Optional link from a commercial lead to the reconciled commercial customer.';

comment on column public.leads.phone_e164 is
  'Normalized commercial phone for lead/customer reconciliation. Not used for RSVP guest identity.';

comment on column public.leads.fbp is
  'Copied Meta browser identifier from the originating commercial session or lead payload.';

comment on column public.leads.fbc is
  'Copied Meta click identifier from the originating commercial session or lead payload.';

comment on column public.leads.fbclid is
  'Copied fbclid value from the originating commercial session or lead payload.';

comment on table public.sales_orders is
  'Manual commercial orders. This is the source of truth for paid sales attribution, separate from invitations and RSVP guests.';

comment on column public.sales_orders.status is
  'Commercial sales status. Meta Purchase is only eligible on the first real deposit_paid transition.';

comment on table public.meta_conversion_events is
  'Outbox and idempotency ledger for future server-side Meta CAPI events. Stores delivery state, not raw CAPI payloads.';

comment on column public.meta_conversion_events.event_id is
  'Stable Meta deduplication key. Purchase uses purchase:{order_id}:deposit_paid.';

comment on column public.meta_conversion_events.value is
  'Actual amount paid for the qualifying conversion event, in the row currency.';

commit;
