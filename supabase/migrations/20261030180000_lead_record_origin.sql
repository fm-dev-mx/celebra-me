-- Lead record: origin and sales stage of each chat, plus the per-ad code catalog.
-- Spec: docs/domains/tracking/commercial-attribution.md (Lead record and origin)
--
-- Every lead now records its route: «landing» when the website created it (the CM- code travels in
-- the WhatsApp message) or «chat» when the owner captured it from a WhatsApp conversation that
-- opened with a per-ad code such as A07. Landing leads also keep utm_content and the TikTok click
-- ID; ctwa_clid stays empty until click-to-WhatsApp IDs are read from the WhatsApp API.
--
-- The sales stage is separate from the legacy status column, which the sales workspace still uses.
-- Each stage keeps the time it was last entered, so the funnel can be measured without a log table.
-- A lost lead must carry its reason.
--
-- Registered as expand: nullable columns, a defaulted stage, checks that every existing row meets
-- and a new service-only table. The deployed application never reads or writes them.
begin;

create table public.lead_ad_codes (
  code text primary key check (code ~ '^[A-Z]{1,3}[0-9]{1,4}$'),
  label text not null check (char_length(label) between 1 and 120),
  platform text not null default 'meta' check (platform in ('meta', 'tiktok', 'other')),
  campaign text null check (campaign is null or char_length(campaign) between 1 and 180),
  ad_name text null check (ad_name is null or char_length(ad_name) between 1 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table public.lead_ad_codes from public, anon, authenticated, service_role;
alter table public.lead_ad_codes enable row level security;
alter table public.lead_ad_codes force row level security;
grant select, insert, update on table public.lead_ad_codes to service_role;
create policy lead_ad_codes_service_role_full_access
  on public.lead_ad_codes
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.lead_ad_codes is
  'Per-ad codes (for example A07) the owner puts in the prefilled WhatsApp message of an ad.';

alter table public.leads
  add column if not exists route text null check (route is null or route in ('landing', 'chat')),
  add column if not exists ad_code text null
    references public.lead_ad_codes (code) on update cascade on delete set null,
  add column if not exists utm_content text null
    check (utm_content is null or char_length(utm_content) between 1 and 180),
  add column if not exists ttclid text null
    check (ttclid is null or char_length(ttclid) between 1 and 500),
  add column if not exists ctwa_clid text null
    check (ctwa_clid is null or char_length(ctwa_clid) between 1 and 500),
  add column if not exists stage text not null default 'new'
    check (stage in (
      'new', 'qualified', 'order_confirmed', 'order_cancelled', 'paid_delivered', 'lost'
    )),
  add column if not exists lost_reason text null
    check (lost_reason is null or lost_reason in ('price', 'date', 'other_option', 'no_reply')),
  add column if not exists package_value numeric(12, 2) null
    check (package_value is null or package_value >= 0),
  add column if not exists stage_changed_at timestamptz null,
  add column if not exists qualified_at timestamptz null,
  add column if not exists order_confirmed_at timestamptz null,
  add column if not exists order_cancelled_at timestamptz null,
  add column if not exists paid_delivered_at timestamptz null,
  add column if not exists lost_at timestamptz null;

alter table public.leads
  add constraint leads_lost_reason_stage_check
  check ((stage = 'lost') = (lost_reason is not null));

create index if not exists leads_stage_created_at_idx
  on public.leads (stage, created_at desc);
create index if not exists leads_ad_code_idx
  on public.leads (ad_code)
  where ad_code is not null;

comment on column public.leads.route is
  'landing: created by the website with a CM- code. chat: captured from a WhatsApp conversation.';
comment on column public.leads.ad_code is
  'Per-ad code read from the first WhatsApp message (chat route).';
comment on column public.leads.ctwa_clid is
  'Click-to-WhatsApp click ID, empty until it is read from the WhatsApp API.';
comment on column public.leads.stage is
  'Sales stage: new, qualified, order_confirmed, order_cancelled, paid_delivered or lost.';
comment on column public.leads.lost_reason is
  'Why a lost lead was lost: price, date, other_option or no_reply. Required when stage is lost.';
comment on column public.leads.stage_changed_at is
  'Last time the stage changed. Each <stage>_at column keeps the last time that stage was entered.';

commit;
