begin;

-- Supabase installs pgcrypto in the `extensions` schema. Recreate only the
-- already-reviewed RPC body with an explicitly qualified digest reference.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.adopt_managed_invitation_legacy_atomic(text,uuid,uuid,uuid,timestamptz,integer,text,text,text,text,text,text,text,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_definition;

  if v_definition is null or position('encode(digest(' in v_definition) = 0 then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_rpc_unexpected_definition';
  end if;

  execute replace(v_definition, 'encode(digest(', 'encode(extensions.digest(');
end;
$$;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.adopt_managed_invitation_legacy_atomic(text,uuid,uuid,uuid,timestamptz,integer,text,text,text,text,text,text,text,text,text,text,text,text,jsonb)'::regprocedure
  ) into v_definition;
  if position('encode(extensions.digest(' in v_definition) = 0 then
    raise exception using errcode = 'P0001', message = 'legacy_adoption_rpc_digest_fix_not_applied';
  end if;
end;
$$;

commit;
