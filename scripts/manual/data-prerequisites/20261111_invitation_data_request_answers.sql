-- Read-only verification that every invitation_data_requests.answers is a JSON object.
-- The reader (src/lib/invitation-data/repository.ts) does `row.answers ?? {}` and trusts the keys.
-- Prints totals only; never rows or answer values.
BEGIN TRANSACTION READ ONLY;

WITH totals AS (
  SELECT
    count(*) AS checked_rows,
    count(*) FILTER (WHERE jsonb_typeof(answers) IS DISTINCT FROM 'object') AS answers_not_object
  FROM public.invitation_data_requests
)
SELECT *, answers_not_object = 0 AS ok FROM totals;

ROLLBACK;
