-- Invitation data requests: the private «Datos de su invitación» form a client fills in after the
-- deposit, and the CompleteRegistration conversion it sends to Meta.
-- Spec: docs/domains/tracking/commercial-attribution.md (Invitation data link)
--
-- Marking a deposit as paid lets the dashboard issue a private /mi-invitacion/<token> link for that
-- order. Only the SHA-256 of the token is stored: the owner sees the link once, and issuing a new
-- one replaces the hash, so the previous link stops working. The client's answers are autosaved as
-- one JSON object on the order's single row; the owner is notified in the dashboard until the
-- latest saved answers have been reviewed.
--
-- The first submission enqueues one CompleteRegistration row per order in the Meta conversion
-- outbox (measurement only, no value). Like Purchase it belongs to the order and follows the
-- order's lead consent; the retention purge never deletes it.
--
-- Registered as contract only because the CHECK swaps on meta_conversion_events use DROP
-- CONSTRAINT. The new table is additive, every check change widens what the outbox accepts, and
-- the shape check keeps the existing rows exactly as strict as before.
begin;

create table public.invitation_data_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.sales_orders(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 32768),
  status text not null default 'sent'
    check (status in ('sent', 'in_progress', 'submitted')),
  last_saved_at timestamptz null,
  submitted_at timestamptz null,
  owner_reviewed_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitation_data_requests_expiry_check check (expires_at > token_issued_at),
  constraint invitation_data_requests_submitted_check
    check ((status = 'submitted') = (submitted_at is not null))
);

comment on table public.invitation_data_requests is
  'Private invitation data form of one sales order: token hash, autosaved answers and review state.';
comment on column public.invitation_data_requests.token_hash is
  'SHA-256 (hex) of the /mi-invitacion/<token> secret. The token itself is never stored.';
comment on column public.invitation_data_requests.answers is
  'Client answers keyed by form field name; validated by the application before every save.';
comment on column public.invitation_data_requests.submitted_at is
  'First submission. Later saves keep it and move last_saved_at.';
comment on column public.invitation_data_requests.owner_reviewed_at is
  'When the owner last marked the answers as reviewed; newer saves notify the owner again.';

drop trigger if exists trg_invitation_data_requests_touch_updated_at
  on public.invitation_data_requests;
create trigger trg_invitation_data_requests_touch_updated_at
  before update on public.invitation_data_requests
  for each row execute function public.touch_updated_at();

-- The dashboard inbox lists submitted forms whose latest save has not been reviewed.
create index if not exists idx_invitation_data_requests_submitted
  on public.invitation_data_requests (last_saved_at desc)
  where status = 'submitted';

revoke all on table public.invitation_data_requests from public, anon, authenticated, service_role;
alter table public.invitation_data_requests enable row level security;
alter table public.invitation_data_requests force row level security;
grant select, insert, update on table public.invitation_data_requests to service_role;

-- Meta conversion outbox: one CompleteRegistration per order when the client submits the form.
alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_event_name_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_event_name_check
  check (event_name in (
    'Purchase',
    'Contact',
    'Lead',
    'PageView',
    'ViewContent',
    'CompleteRegistration'
  ));

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_trigger_status_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_trigger_status_check
  check (trigger_status in (
    'deposit_paid',
    'whatsapp_contact_clicked',
    'form_submitted',
    'page_viewed',
    'demo_viewed',
    'package_viewed',
    'invitation_data_submitted'
  ));

-- Purchase rows keep their order, customer and value; CompleteRegistration rows keep their order
-- and customer without a value; browser rows carry their session instead.
alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_source_shape_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_source_shape_check
  check (
    (event_name = 'Purchase'
      and trigger_status = 'deposit_paid'
      and order_id is not null
      and customer_id is not null
      and value is not null)
    or (event_name = 'CompleteRegistration'
      and trigger_status = 'invitation_data_submitted'
      and order_id is not null
      and customer_id is not null
      and value is null)
    or (order_id is null
      and session_id is not null
      and ((event_name = 'Contact' and trigger_status = 'whatsapp_contact_clicked')
        or (event_name = 'Lead' and trigger_status = 'form_submitted')
        or (event_name = 'PageView' and trigger_status = 'page_viewed')
        or (event_name = 'ViewContent' and trigger_status in ('demo_viewed', 'package_viewed'))))
  );

commit;
