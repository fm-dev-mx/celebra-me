-- =============================================================================
-- Migración: Soft Delete Columns Only
-- =============================================================================
-- Agrega columnas deleted_at sin modificar políticas existentes
-- =============================================================================

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.guest_invitations 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.event_claim_codes 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.event_memberships 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_events_deleted_at 
ON public.events(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_guest_invitations_deleted_at 
ON public.guest_invitations(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_claim_codes_deleted_at 
ON public.event_claim_codes(deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_deleted_at 
ON public.event_memberships(deleted_at) 
WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.events.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.guest_invitations.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.event_claim_codes.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.event_memberships.deleted_at IS 'Timestamp de soft delete. NULL = activo';
