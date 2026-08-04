-- Durable, single-use receipts for externally signed Production approvals.

CREATE TABLE IF NOT EXISTS public.production_authorization_receipts (
  operation_id text PRIMARY KEY,
  nonce text NOT NULL UNIQUE,
  operation_type text NOT NULL,
  target_env text NOT NULL CHECK (target_env = 'production'),
  scope text NOT NULL,
  manifest_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.production_authorization_receipts IS
  'Single-use externally signed Production authorization receipts; writes are performed by guarded owner workflows only.';

ALTER TABLE public.production_authorization_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.production_authorization_receipts FROM PUBLIC, anon, authenticated;
