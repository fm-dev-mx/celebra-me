-- =============================================================================
-- Migración: Soft Delete para tablas críticas
-- =============================================================================
-- Esta migración agrega soporte para soft delete en las tablas principales
-- permitiendo recuperación de datos eliminados accidentalmente
-- =============================================================================

-- =============================================================================
-- 1. Agregar columnas deleted_at a las tablas
-- =============================================================================

-- Tabla: events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Tabla: guest_invitations
ALTER TABLE public.guest_invitations 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Tabla: event_claim_codes
ALTER TABLE public.event_claim_codes 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Tabla: event_memberships
ALTER TABLE public.event_memberships 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- =============================================================================
-- 2. Crear índices para optimizar queries
-- =============================================================================

-- Índices para filtrar registros no eliminados
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

-- =============================================================================
-- 3. Actualizar RLS policies para excluir soft deleted
-- =============================================================================

-- Events: Solo mostrar no eliminados
DROP POLICY IF EXISTS "Events: owner can manage" ON public.events;
CREATE POLICY "Events: owner can manage" ON public.events
    FOR ALL
    USING (deleted_at IS NULL AND (
        owner_user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM app_user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    ));

-- Guest invitations: Solo mostrar no eliminados
DROP POLICY IF EXISTS "GuestInvitations: event owners can manage" ON public.guest_invitations;
CREATE POLICY "GuestInvitations: event owners can manage" ON public.guest_invitations
    FOR ALL
    USING (deleted_at IS NULL AND (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_id 
            AND e.deleted_at IS NULL
            AND (e.owner_user_id = auth.uid() OR
                EXISTS (SELECT 1 FROM event_memberships em 
                       WHERE em.event_id = e.id AND em.user_id = auth.uid()))
        ) OR
        EXISTS (SELECT 1 FROM app_user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
    ));

-- Event claim codes: Solo mostrar no eliminados (ya restringido a service_role)
-- No necesita cambio, service_role tiene acceso total

-- Event memberships: Solo mostrar no eliminados
DROP POLICY IF EXISTS "EventMemberships: view own" ON public.event_memberships;
CREATE POLICY "EventMemberships: view own" ON public.event_memberships
    FOR SELECT
    USING (deleted_at IS NULL AND user_id = auth.uid());

-- =============================================================================
-- 4. Crear función RPC para soft delete de eventos
-- =============================================================================

CREATE OR REPLACE FUNCTION soft_delete_event(
    p_event_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing events%ROWTYPE;
    v_is_owner boolean;
    v_is_admin boolean;
BEGIN
    -- Obtener evento
    SELECT * INTO v_existing
    FROM public.events
    WHERE id = p_event_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Verificar ownership
    v_is_owner := v_existing.owner_user_id = p_user_id;
    
    -- Verificar si es super_admin
    SELECT EXISTS(
        SELECT 1 FROM app_user_roles 
        WHERE user_id = p_user_id AND role = 'super_admin'
    ) INTO v_is_admin;
    
    -- Permitir solo si es owner o admin
    IF NOT (v_is_owner OR v_is_admin) THEN
        RETURN false;
    END IF;
    
    -- Soft delete del evento (cascade a guests y memberships por FK)
    UPDATE public.events 
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_event_id;
    
    -- Soft delete de guests asociados
    UPDATE public.guest_invitations
    SET deleted_at = NOW()
    WHERE event_id = p_event_id AND deleted_at IS NULL;
    
    -- Soft delete de memberships asociadas
    UPDATE public.event_memberships
    SET deleted_at = NOW()
    WHERE event_id = p_event_id AND deleted_at IS NULL;
    
    -- Soft delete de claim codes asociados
    UPDATE public.event_claim_codes
    SET deleted_at = NOW()
    WHERE event_id = p_event_id AND deleted_at IS NULL;
    
    -- Audit log
    INSERT INTO audit_logs (actor_id, action, target_table, target_id, old_data)
    VALUES (p_user_id, 'soft_delete_event', 'events', p_event_id, to_jsonb(v_existing));
    
    RETURN true;
END;
$$;

-- =============================================================================
-- 5. Crear función RPC para restaurar eventos (solo super_admin)
-- =============================================================================

CREATE OR REPLACE FUNCTION restore_event(
    p_event_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
BEGIN
    -- Verificar si es super_admin
    SELECT EXISTS(
        SELECT 1 FROM app_user_roles 
        WHERE user_id = p_user_id AND role = 'super_admin'
    ) INTO v_is_admin;
    
    IF NOT v_is_admin THEN
        RETURN false;
    END IF;
    
    -- Restaurar evento
    UPDATE public.events 
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = p_event_id AND deleted_at IS NOT NULL;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Restaurar guests asociados
    UPDATE public.guest_invitations
    SET deleted_at = NULL
    WHERE event_id = p_event_id AND deleted_at IS NOT NULL;
    
    -- Restaurar memberships asociadas
    UPDATE public.event_memberships
    SET deleted_at = NULL
    WHERE event_id = p_event_id AND deleted_at IS NOT NULL;
    
    -- Restaurar claim codes asociados
    UPDATE public.event_claim_codes
    SET deleted_at = NULL
    WHERE event_id = p_event_id AND deleted_at IS NOT NULL;
    
    -- Audit log
    INSERT INTO audit_logs (actor_id, action, target_table, target_id, new_data)
    VALUES (p_user_id, 'restore_event', 'events', p_event_id, jsonb_build_object('restored_at', NOW()));
    
    RETURN true;
END;
$$;

-- =============================================================================
-- 6. Crear vista para listar eventos eliminados (papelera)
-- =============================================================================

CREATE OR REPLACE VIEW deleted_events AS
SELECT 
    e.id,
    e.title,
    e.slug,
    e.event_type,
    e.owner_user_id,
    e.deleted_at,
    e.created_at,
    hp.display_name as owner_name
FROM public.events e
LEFT JOIN public.host_profiles hp ON hp.user_id = e.owner_user_id
WHERE e.deleted_at IS NOT NULL
ORDER BY e.deleted_at DESC;

-- =============================================================================
-- 7. Comentarios de documentación
-- =============================================================================

COMMENT ON COLUMN public.events.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.guest_invitations.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.event_claim_codes.deleted_at IS 'Timestamp de soft delete. NULL = activo';
COMMENT ON COLUMN public.event_memberships.deleted_at IS 'Timestamp de soft delete. NULL = activo';

COMMENT ON FUNCTION soft_delete_event IS 'Realiza soft delete de un evento y sus relaciones. Requiere ser owner o super_admin.';
COMMENT ON FUNCTION restore_event IS 'Restaura un evento eliminado. Solo super_admin.';
COMMENT ON VIEW deleted_events IS 'Vista de eventos en la papelera. Solo super_admin tiene acceso.';

-- =============================================================================
-- Fin de la migración
-- =============================================================================
