-- Record completed anonymization independently from session revocation.
begin;
alter table public.valentina_memory_sessions
  add column if not exists anonymized_at timestamptz;
create index if not exists idx_valentina_memory_sessions_pending_anonymization
  on public.valentina_memory_sessions (event_key, expires_at, id)
  where anonymized_at is null;

-- Same event lock order as reservation prevents a new object racing the empty check.
-- Session lock makes concurrent/retried calls a no-op after the first successful transaction.
create or replace function public.anonymize_valentina_memory_session(
  p_event_key text, p_session_id uuid, p_token_hash text,
  p_recovery_code_hash text, p_audit_expires_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_key, 0));
  perform 1 from public.valentina_memory_sessions
  where id = p_session_id and event_key = p_event_key and anonymized_at is null
  for update;
  if not found then return false; end if;
  if exists (select 1 from public.valentina_memory_items
    where session_id = p_session_id and object_deleted_at is null) then
    return false;
  end if;
  if p_token_hash is null or p_recovery_code_hash is null
    or p_audit_expires_at is null or p_audit_expires_at <= pg_catalog.now() then
    raise exception 'Invalid anonymization parameters';
  end if;
  update public.valentina_memory_sessions set
    display_name = 'Invitado retirado', token_hash = p_token_hash,
    recovery_code_hash = p_recovery_code_hash,
    revoked_at = coalesce(revoked_at, pg_catalog.now()), anonymized_at = pg_catalog.now()
  where id = p_session_id;
  insert into public.valentina_memory_audit_events
    (event_key, actor_type, action, metadata, expires_at)
  values (p_event_key, 'system', 'guest_session_anonymized', '{}'::jsonb, p_audit_expires_at);
  return true;
end;
$function$;
revoke all on function public.anonymize_valentina_memory_session(text,uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.anonymize_valentina_memory_session(text,uuid,text,text,timestamptz)
  to service_role;
comment on column public.valentina_memory_sessions.anonymized_at is
  'Set atomically with anonymization and its audit; NULL includes legacy rows requiring one final cleanup.';
notify pgrst, 'reload schema';
commit;
