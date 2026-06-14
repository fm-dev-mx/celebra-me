alter table public.guest_invitations
  add column last_reminder_sent_at timestamptz null;
