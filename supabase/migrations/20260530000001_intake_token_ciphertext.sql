-- Recoverable intake capture links for admins.
-- Public lookup continues to use token_hash; ciphertext is decrypted server-side only.

alter table public.intake_requests
  add column if not exists token_ciphertext text null;

comment on column public.intake_requests.token_ciphertext is
  'AES-256-GCM encrypted raw intake token for admin-only capture-link recovery. Public lookup continues to use token_hash.';
