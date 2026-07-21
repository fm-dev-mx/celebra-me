-- guestCap and per-guest attendee limits are customer configuration, not a
-- fixed 20-person product tier. PostgreSQL integer storage supplies the
-- technical upper bound (2,147,483,647); these checks retain only the domain
-- lower bounds.
ALTER TABLE public.guest_invitations
  DROP CONSTRAINT IF EXISTS guest_invitations_max_allowed_attendees_check,
  DROP CONSTRAINT IF EXISTS guest_invitations_attendee_count_check;

ALTER TABLE public.guest_invitations
  ADD CONSTRAINT guest_invitations_max_allowed_attendees_check
    CHECK (max_allowed_attendees >= 1),
  ADD CONSTRAINT guest_invitations_attendee_count_check
    CHECK (attendee_count >= 0 AND attendee_count <= max_allowed_attendees);
