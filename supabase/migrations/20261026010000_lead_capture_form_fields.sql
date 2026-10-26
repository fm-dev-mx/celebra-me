-- Leads: structured answers of the short «Aparta su fecha» form shown before WhatsApp.
-- Spec: docs/domains/tracking/commercial-attribution.md (Lead capture form)
--
-- The landing and demo pages ask for the event type, the event date, the celebrant names, the
-- WhatsApp number and the chosen demo before opening WhatsApp. The event type and phone already
-- have columns; the date, the names and the demo get their own so the later invitation-data form
-- can prefill them.
--
-- Registered as expand: three nullable columns with length and range checks. Existing rows keep
-- null and the deployed application never reads or writes them.
begin;

alter table public.leads
  add column if not exists event_date date null
    check (event_date is null or event_date between date '2020-01-01' and date '2100-12-31'),
  add column if not exists celebrant_names text null
    check (celebrant_names is null or char_length(celebrant_names) between 1 and 120),
  add column if not exists demo_slug text null
    check (demo_slug is null or demo_slug ~ '^[a-z0-9][a-z0-9-]{0,79}$');

comment on column public.leads.event_date is
  'Event date given in the lead capture form; null for leads from other channels.';
comment on column public.leads.celebrant_names is
  'Celebrant names given in the lead capture form (for example «Andrea» or «Daniela y Martín»).';
comment on column public.leads.demo_slug is
  'Demo the visitor chose in the lead capture form, prefilled on demo pages.';

commit;
