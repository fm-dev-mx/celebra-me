begin;
select no_plan();
select ok(not has_function_privilege('anon','public.anonymize_valentina_memory_session(text,uuid,text,text,timestamptz)','execute'), 'anonymous callers cannot anonymize');
select ok(not has_function_privilege('authenticated','public.anonymize_valentina_memory_session(text,uuid,text,text,timestamptz)','execute'), 'authenticated callers cannot anonymize');
select ok(has_function_privilege('service_role','public.anonymize_valentina_memory_session(text,uuid,text,text,timestamptz)','execute'), 'service can anonymize');
insert into public.valentina_memory_sessions(id,event_key,token_hash,recovery_code_hash,expires_at,display_name,guest_alias,revoked_at)
select ('92000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'anonymization-test','token-'||n,'recovery-'||n,now()-interval '1 day','Invitado sintético','invitado-9200000'||n,case when n=2 then now()-interval '1 hour' else null end
from generate_series(1,4) n;
select ok(public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000001','replaced-1','recovery-new-1',now()+interval '1 day'), 'empty expired session is anonymized');
select ok((select anonymized_at is not null and revoked_at is not null and display_name='Invitado retirado' and token_hash='replaced-1' from public.valentina_memory_sessions where id='92000000-0000-4000-8000-000000000001'), 'identity and completion marker change together');
select ok(not public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000001','retry-token','retry-recovery',now()+interval '1 day'), 'retry does no work');
select is((select count(*) from public.valentina_memory_audit_events where event_key='anonymization-test'),1::bigint,'retry creates no second audit');
select is((select token_hash from public.valentina_memory_sessions where id='92000000-0000-4000-8000-000000000001'),'replaced-1','retry does not rotate credentials');
select ok(public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000002','replaced-2','recovery-new-2',now()+interval '1 day'), 'revoked but unfinished session still anonymizes');
insert into public.valentina_memory_items(id,event_key,session_id,object_key,mime_type,size_bytes,status)
values('93000000-0000-4000-8000-000000000003','anonymization-test','92000000-0000-4000-8000-000000000003','anonymization-test-only','image/jpeg',100,'accepted');
select ok(not public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000003','replaced-3','recovery-new-3',now()+interval '1 day'), 'undeleted object prevents anonymization');
select ok(not public.anonymize_valentina_memory_session('wrong-event','92000000-0000-4000-8000-000000000004','replaced-4','recovery-new-4',now()+interval '1 day'), 'wrong event cannot touch a session');
select ok((select anonymized_at is null and display_name='Invitado sintético' from public.valentina_memory_sessions where id='92000000-0000-4000-8000-000000000003'), 'retained session remains intact');
update public.valentina_memory_items set object_deleted_at=now() where id='93000000-0000-4000-8000-000000000003';
select ok(public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000003','replaced-3','recovery-new-3',now()+interval '1 day'), 'physical deletion enables anonymization');
create function pg_temp.reject_anonymization_audit() returns trigger language plpgsql as $test$ begin raise exception 'synthetic audit failure'; end; $test$;
create trigger test_reject_anonymization_audit before insert on public.valentina_memory_audit_events for each row execute function pg_temp.reject_anonymization_audit();
select throws_ok($call$ select public.anonymize_valentina_memory_session('anonymization-test','92000000-0000-4000-8000-000000000004','replaced-4','recovery-new-4',now()+interval '1 day') $call$, 'P0001', 'synthetic audit failure', 'audit failure aborts transaction');
select ok((select anonymized_at is null and token_hash='token-4' from public.valentina_memory_sessions where id='92000000-0000-4000-8000-000000000004'), 'audit failure rolls back identity and marker');
select * from finish();
rollback;
