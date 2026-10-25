-- Meta conversion outbox: accept browser Contact and Lead events next to deposit Purchases.
-- Spec: docs/domains/tracking/commercial-attribution.md (Conversions API)
--
-- Tracking ingestion enqueues a Contact (WhatsApp click) or Lead (form submission) row with the
-- tracking event UUID as event_id, the same ID the Meta Pixel sends as eventID, so Meta
-- deduplicates the browser and server copies. These rows carry the visitor session instead of an
-- order and have no value. session_id has no foreign key on purpose: the 13-month analytics purge
-- must stay free to delete the session after delivery.
--
-- It also records marketing withdrawals per visitor (visitor_consent_withdrawals) and keeps
-- visitor_sessions from turning marketing back on with an older decision.
--
-- Registered as contract only because the CHECK swaps use DROP CONSTRAINT and DROP NOT NULL.
-- Every change widens what the table accepts; existing Purchase rows and the deployed
-- application keep working, and the shape check keeps Purchase rows exactly as strict as before.
begin;

alter table public.meta_conversion_events
  add column if not exists session_id uuid null,
  add column if not exists event_source_path text null
    check (event_source_path is null or char_length(event_source_path) <= 512);

alter table public.meta_conversion_events alter column order_id drop not null;
alter table public.meta_conversion_events alter column customer_id drop not null;
alter table public.meta_conversion_events alter column value drop not null;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_event_name_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_event_name_check
  check (event_name in ('Purchase', 'Contact', 'Lead'));

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_trigger_status_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_trigger_status_check
  check (trigger_status in ('deposit_paid', 'whatsapp_contact_clicked', 'form_submitted'));

-- Purchase rows keep their order, customer and value; browser rows carry their session instead.
alter table public.meta_conversion_events
  add constraint meta_conversion_events_source_shape_check
  check (
    (event_name = 'Purchase'
      and trigger_status = 'deposit_paid'
      and order_id is not null
      and customer_id is not null
      and value is not null)
    or (event_name = 'Contact'
      and trigger_status = 'whatsapp_contact_clicked'
      and order_id is null
      and session_id is not null)
    or (event_name = 'Lead'
      and trigger_status = 'form_submitted'
      and order_id is null
      and session_id is not null)
  );

comment on column public.meta_conversion_events.session_id is
  'Visitor session of a browser Contact or Lead row. No foreign key, so the analytics purge can delete the session after delivery.';
comment on column public.meta_conversion_events.event_source_path is
  'Route path where a browser Contact or Lead happened; delivery checks it against the tracking route policy.';

-- A marketing withdrawal is sticky. It is recorded per visitor, so it also covers sessions the
-- server has not stored yet: a tracking request sent before the withdrawal but stored after it,
-- as an insert or an update, must not turn marketing back on. Snapshots carry the visitor's
-- decision time (decidedAt, Date#toISOString, validated by the app so text order is time order);
-- only a strictly newer decision turns marketing on again.
create table public.visitor_consent_withdrawals (
  visitor_id text primary key check (char_length(visitor_id) between 6 and 120),
  decided_at text not null
    check (decided_at ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'),
  updated_at timestamptz not null default now()
);

revoke all on table public.visitor_consent_withdrawals from public, anon, authenticated, service_role;
alter table public.visitor_consent_withdrawals enable row level security;
alter table public.visitor_consent_withdrawals force row level security;
grant select, insert, update on table public.visitor_consent_withdrawals to service_role;

comment on table public.visitor_consent_withdrawals is
  'Latest marketing consent withdrawal per visitor; keeps visitor_sessions from turning marketing back on with an older decision.';

create or replace function public.keep_visitor_marketing_withdrawal()
returns trigger as $$
declare
  withdrawn_at text;
  new_decided_at text := new.consent_snapshot->>'decidedAt';
begin
  if coalesce(new.consent_snapshot->'marketing', 'false'::jsonb) <> 'true'::jsonb then
    return new;
  end if;
  select w.decided_at into withdrawn_at
    from public.visitor_consent_withdrawals w
    where w.visitor_id = new.visitor_id;
  if withdrawn_at is not null and (new_decided_at is null or new_decided_at <= withdrawn_at) then
    new.consent_snapshot := jsonb_set(new.consent_snapshot, '{marketing}', 'false'::jsonb);
  end if;
  return new;
end;
$$ language plpgsql set search_path = '';

drop trigger if exists trg_visitor_sessions_keep_marketing_withdrawal on public.visitor_sessions;
create trigger trg_visitor_sessions_keep_marketing_withdrawal
  before insert or update of consent_snapshot on public.visitor_sessions
  for each row execute function public.keep_visitor_marketing_withdrawal();

-- Record a withdrawal (a retried older one never moves the record back) and switch marketing off
-- on the visitor's stored sessions whose snapshot is not newer than the withdrawal.
create or replace function public.record_visitor_marketing_withdrawal(
  p_visitor_id text,
  p_analytics boolean,
  p_decided_at text
)
returns void as $$
begin
  insert into public.visitor_consent_withdrawals as w (visitor_id, decided_at)
  values (p_visitor_id, p_decided_at)
  on conflict (visitor_id) do update
    set decided_at = greatest(w.decided_at, excluded.decided_at),
        updated_at = now();

  update public.visitor_sessions s
    set consent_snapshot = jsonb_build_object(
      'necessary', true,
      'analytics', p_analytics,
      'marketing', false,
      'decidedAt', p_decided_at
    )
    where s.visitor_id = p_visitor_id
      and coalesce(s.consent_snapshot->>'decidedAt', '') <= p_decided_at;
end;
$$ language plpgsql security invoker set search_path = '';

revoke all on function public.record_visitor_marketing_withdrawal(text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_visitor_marketing_withdrawal(text, boolean, text)
  to service_role;

commit;
