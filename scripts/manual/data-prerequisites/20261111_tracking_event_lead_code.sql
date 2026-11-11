-- Read-only verification of tracking_events.event_properties.lead_code, as read by the quote
-- reminder (src/lib/commercial/quote-reminders.service.ts): non-internal events whose
-- `event_properties->>lead_code` matches a quoted lead's code with strict string equality.
-- Prints totals only; never rows, lead codes, or contact data.
BEGIN TRANSACTION READ ONLY;

WITH events AS (
  SELECT id, event_name, event_properties
  FROM public.tracking_events
  WHERE is_internal IS NOT TRUE
), totals AS (
  SELECT
    (SELECT count(*) FROM events) AS checked_events,
    (SELECT count(*) FROM events
      WHERE jsonb_typeof(event_properties) IS DISTINCT FROM 'object') AS event_properties_not_object,
    (SELECT count(*) FROM events
      WHERE jsonb_typeof(event_properties) = 'object'
        AND event_properties ? 'lead_code'
        AND (jsonb_typeof(event_properties->'lead_code') IS DISTINCT FROM 'string'
          OR btrim(event_properties->>'lead_code') = '')) AS lead_code_not_text_or_blank,
    (SELECT count(*) FROM events
      WHERE event_name = 'lead_created'
        AND event_properties->>'lead_code' IS NULL) AS lead_created_without_lead_code,
    (SELECT count(*) FROM public.leads l
      JOIN events e ON e.id = l.source_event_id
      WHERE e.event_properties->>'lead_code' IS NOT NULL
        AND e.event_properties->>'lead_code' IS DISTINCT FROM l.lead_code) AS source_event_lead_code_mismatch,
    -- Informational: quoted leads the reminder sees without any event carrying their code.
    (SELECT count(*) FROM public.leads l
      WHERE l.status = 'quoted'
        AND NOT EXISTS (SELECT 1 FROM events e
          WHERE e.event_properties->>'lead_code' = l.lead_code)) AS quoted_leads_without_events
)
SELECT *,
  event_properties_not_object = 0
    AND lead_code_not_text_or_blank = 0
    AND lead_created_without_lead_code = 0
    AND source_event_lead_code_mismatch = 0 AS ok
FROM totals;

ROLLBACK;
