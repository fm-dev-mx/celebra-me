begin;

alter table public.event_claim_codes
add column if not exists code_key text;

update public.event_claim_codes
set code_key = code_hash
where code_key is null;

do $$
declare
  duplicates text;
begin
  select string_agg(code_key, ', ')
  into duplicates
  from (
    select code_key
    from public.event_claim_codes
    group by code_key
    having count(*) > 1
  ) repeated;

  if duplicates is not null then
    raise exception
      'Duplicate claim codes detected for code_key values: %',
      duplicates;
  end if;
end
$$;

alter table public.event_claim_codes
alter column code_key set not null;

create unique index if not exists idx_event_claim_codes_code_key_unique
on public.event_claim_codes(code_key);

create or replace function public.sync_event_claim_code_key()
returns trigger
language plpgsql
as $$
begin
  if new.code_key is null or btrim(new.code_key) = '' then
    new.code_key := new.code_hash;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_event_claim_codes_sync_code_key on public.event_claim_codes;
create trigger trg_event_claim_codes_sync_code_key
before insert or update on public.event_claim_codes
for each row
execute function public.sync_event_claim_code_key();

commit;
