-- Verification queries for 20260402000100_reconcile_event_slug_parity.sql

select
  event_type,
  slug,
  status,
  title,
  deleted_at
from public.events
where slug in (
  'demo-gerardo-sesenta',
  'demo-xv',
  'gerardo-sesenta',
  'ximena-meza-trasvina'
)
order by event_type, slug;

select
  e.event_type,
  e.slug,
  count(*) as guest_count
from public.events e
join public.guest_invitations gi
  on gi.event_id = e.id
where e.slug in ('gerardo-sesenta', 'ximena-meza-trasvina')
group by e.event_type, e.slug
order by e.event_type, e.slug;

select
  e.event_type,
  e.slug,
  count(*) as membership_count
from public.events e
join public.event_memberships em
  on em.event_id = e.id
where e.slug in ('gerardo-sesenta', 'ximena-meza-trasvina')
group by e.event_type, e.slug
order by e.event_type, e.slug;

select
  e.event_type,
  e.slug,
  count(*) as claim_code_count
from public.events e
join public.event_claim_codes ecc
  on ecc.event_id = e.id
where e.slug in ('gerardo-sesenta', 'ximena-meza-trasvina')
group by e.event_type, e.slug
order by e.event_type, e.slug;
