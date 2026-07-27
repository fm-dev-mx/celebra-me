-- Extend managed release provenance with the last successfully applied
-- normalized content projection and the draft revision it produced.
-- Nullable: established only on controlled apply; no historical backfill.

begin;

alter table public.managed_invitation_release_provenance
	add column if not exists managed_projection jsonb,
	add column if not exists applied_draft_updated_at timestamptz;

comment on column public.managed_invitation_release_provenance.managed_projection is
	'Normalized managed content projection last successfully applied; common ancestor for three-way merges.';

comment on column public.managed_invitation_release_provenance.applied_draft_updated_at is
	'Draft updated_at revision token produced by the last successful managed apply.';

commit;
