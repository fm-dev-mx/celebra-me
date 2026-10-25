-- Expand-only foundation. No collector or migration execution is included.
-- Store aggregate insight rows only; never Graph envelopes, paging URLs or credentials.
-- Explicit windows prevent later refreshes from overwriting different attribution/period data.
begin;

create table public.meta_ads_insights_daily (
  account_id text not null check (length(btrim(account_id)) > 0),
  level text not null check (level in ('campaign', 'adset', 'ad')),
  object_id text not null check (length(btrim(object_id)) > 0),
  insight_date date not null,
  attribution_window text not null check (length(btrim(attribution_window)) > 0),
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  collected_at timestamptz not null default now(),
  primary key (account_id, level, object_id, insight_date, attribution_window)
);

revoke all on table public.meta_ads_insights_daily from public, anon, authenticated, service_role;
alter table public.meta_ads_insights_daily enable row level security;
alter table public.meta_ads_insights_daily force row level security;

create table public.meta_organic_insights_daily (
  platform text not null check (platform in ('facebook', 'instagram')),
  account_id text not null check (length(btrim(account_id)) > 0),
  level text not null check (level in ('page', 'ig_user')),
  object_id text not null check (length(btrim(object_id)) > 0),
  insight_date date not null,
  metric_period text not null check (length(btrim(metric_period)) > 0),
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  collected_at timestamptz not null default now(),
  primary key (platform, account_id, level, object_id, insight_date, metric_period),
  constraint meta_organic_insights_daily_platform_level check (
    (platform = 'facebook' and level = 'page') or
    (platform = 'instagram' and level = 'ig_user')
  )
);

revoke all on table public.meta_organic_insights_daily from public, anon, authenticated, service_role;
alter table public.meta_organic_insights_daily enable row level security;
alter table public.meta_organic_insights_daily force row level security;
grant select, insert, update on table public.meta_organic_insights_daily to service_role;
grant select, insert, update on table public.meta_ads_insights_daily to service_role;

comment on table public.meta_ads_insights_daily is
  'Daily aggregate ad insights by explicit attribution window. Service role only, upsert refreshes revised results.';
comment on table public.meta_organic_insights_daily is
  'Daily Page and Instagram account aggregates by explicit metric period. Service role only, no personal data.';

commit;
