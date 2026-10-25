-- Visitor session client signals (expand): keep the browser IP address and user agent of a
-- marketing-consented session so Meta Conversions API events can match the visitor.
-- Spec: docs/domains/tracking/commercial-attribution.md (Conversions API)
--
-- Both columns are written only when the session carries marketing consent, are kept with the
-- session under the 13-month commercial analytics retention, and keep their first value on
-- later updates, like the other first-touch attribution columns.
begin;

alter table public.visitor_sessions
  add column if not exists client_ip_address text null
    check (client_ip_address is null or char_length(client_ip_address) <= 100),
  add column if not exists client_user_agent text null
    check (client_user_agent is null or char_length(client_user_agent) <= 512);

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
  new.client_ip_address := coalesce(old.client_ip_address, new.client_ip_address);
  new.client_user_agent := coalesce(old.client_user_agent, new.client_user_agent);
  return new;
end;
$$ language plpgsql;

comment on column public.visitor_sessions.client_ip_address is
  'Visitor IP address from the platform proxy header. Stored only with marketing consent; sent unhashed as Meta CAPI client_ip_address.';
comment on column public.visitor_sessions.client_user_agent is
  'Browser user agent (at most 512 characters). Stored only with marketing consent; sent as Meta CAPI client_user_agent.';

commit;
