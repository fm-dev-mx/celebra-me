begin;
select plan(10);
select has_column('public', 'invitations', 'work_status', 'work status exists');
select col_default_is('public', 'invitations', 'work_status', 'in_progress', 'new work starts in progress');
select has_column('public', 'invitations', 'owner_reviewed_at', 'review timestamp exists');
select has_column('public', 'invitations', 'owner_reviewed_by', 'review actor exists');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.invitations'::regclass and conname = 'invitation_owner_review_pair'
), 'review date and actor must be both present or both absent');
select ok(not has_column_privilege('authenticated', 'public.invitations', 'owner_reviewed_at', 'UPDATE'), 'client cannot overwrite review date');
select ok(not has_column_privilege('authenticated', 'public.invitations', 'owner_reviewed_by', 'INSERT'), 'client cannot forge review on insertion');
select ok(not has_column_privilege('authenticated', 'public.invitations', 'work_status', 'UPDATE'), 'work mutation uses server authorization');
select ok(has_column_privilege('authenticated', 'public.invitations', 'title', 'UPDATE'), 'existing client column grants remain');
select ok(has_column_privilege('service_role', 'public.invitations', 'owner_reviewed_at', 'UPDATE'), 'authorized server can persist review');
select * from finish();
rollback;
