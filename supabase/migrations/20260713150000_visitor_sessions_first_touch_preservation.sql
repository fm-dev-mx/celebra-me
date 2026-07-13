-- @script-id: 20260713_visitor_sessions_first_touch_preservation
-- @purpose: Preserve first-touch attribution columns in visitor_sessions on conflict update
-- @env: production
-- @ticket: P0 Meta Pixel and Attribution Integrity
-- @tables: public.visitor_sessions
-- @operation: update

begin;

create or replace function public.preserve_visitor_session_first_touch()
returns trigger as $$
begin
  new.landing_path := coalesce(old.landing_path, new.landing_path);
  new.referrer := coalesce(old.referrer, new.referrer);
  new.utm_source := coalesce(old.utm_source, new.utm_source);
  new.utm_medium := coalesce(old.utm_medium, new.utm_medium);
  new.utm_campaign := coalesce(old.utm_campaign, new.utm_campaign);
  new.utm_content := coalesce(old.utm_content, new.utm_content);
  new.utm_term := coalesce(old.utm_term, new.utm_term);
  new.fbp := coalesce(old.fbp, new.fbp);
  new.fbc := coalesce(old.fbc, new.fbc);
  new.fbclid := coalesce(old.fbclid, new.fbclid);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_visitor_sessions_preserve_first_touch on public.visitor_sessions;
create trigger trg_visitor_sessions_preserve_first_touch
  before update on public.visitor_sessions
  for each row execute function public.preserve_visitor_session_first_touch();

commit;
