-- @script-id: 20261112_tracking_events_blank_lead_code
-- @purpose: Remove the blank lead_code key that CTA clicks stored on non-WhatsApp events, so every stored lead_code names a lead; ingestion now drops a blank lead_code before insert
-- @env: production
-- @ticket: Data prerequisite tracking-event-lead-code reported lead_code_not_text_or_blank=533 on 2026-11-12 (cta_clicked 523, whatsapp_contact_clicked 10, all blank strings)
-- @tables: public.tracking_events
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1500
-- @requires-backup: true
-- @dry-run-query: select id from public.tracking_events where is_internal is not true and jsonb_typeof(event_properties) = 'object' and jsonb_typeof(event_properties->'lead_code') = 'string' and btrim(event_properties->>'lead_code') = ''
-- @rollback: update public.tracking_events set event_properties = event_properties || jsonb_build_object('lead_code', '') where id in (the ids listed by the reviewed plan); a blank lead_code matches no lead, so the rollback only restores the empty key, and the critical backup keeps the previous event_properties

begin;

update public.tracking_events
set event_properties = event_properties - 'lead_code'
where is_internal is not true
  and jsonb_typeof(event_properties) = 'object'
  and jsonb_typeof(event_properties->'lead_code') = 'string'
  and btrim(event_properties->>'lead_code') = '';

commit;
