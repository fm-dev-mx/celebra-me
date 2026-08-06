-- Central Preview release-approval store (SSOT across worktrees).
-- Runtime reads/writes target the Preview project via service-role / owner CLI.
-- Schema is applied to all environments for migration-history parity.

CREATE TABLE IF NOT EXISTS public.preview_approval_artifacts (
  package_hash text PRIMARY KEY,
  slug text NOT NULL,
  route text NOT NULL,
  approval_state text NOT NULL
    CHECK (approval_state IN ('pending_hosted_validation', 'approved')),
  schema_version text NOT NULL,
  source_hash text NOT NULL,
  metadata_hash text NOT NULL,
  canonical_projection_hash text NOT NULL,
  materialized_projection_hash text NOT NULL,
  asset_manifest_hash text NOT NULL,
  plan_id text,
  preview_project_ref text NOT NULL,
  intended_production_project_ref text,
  expected_asset_hashes jsonb NOT NULL DEFAULT '{}'::jsonb,
  hosted_validation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by text,
  -- Plain column: timestamptz + interval is not IMMUTABLE, so GENERATED STORED fails on Postgres.
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  CONSTRAINT preview_approval_artifacts_approved_fields_chk CHECK (
    (
      approval_state = 'pending_hosted_validation'
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND hosted_validation IS NULL
    )
    OR (
      approval_state = 'approved'
      AND approved_at IS NOT NULL
      AND approved_by IS NOT NULL
      AND hosted_validation IS NOT NULL
      AND intended_production_project_ref IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.preview_approval_artifacts IS
  'Canonical Preview release approvals for managed invitation promotion; owner CLI / service-role only.';

COMMENT ON COLUMN public.preview_approval_artifacts.package_hash IS
  'Exact managed package hash (SHA-256). Primary release identity.';

COMMENT ON COLUMN public.preview_approval_artifacts.expires_at IS
  'Cleanup horizon (created_at + 7 days). Promote freshness still validates approved_at in app code.';

CREATE INDEX IF NOT EXISTS preview_approval_artifacts_slug_state_idx
  ON public.preview_approval_artifacts (slug, approval_state);

CREATE INDEX IF NOT EXISTS preview_approval_artifacts_state_expires_idx
  ON public.preview_approval_artifacts (approval_state, expires_at);

ALTER TABLE public.preview_approval_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.preview_approval_artifacts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.preview_approval_artifacts TO service_role;
