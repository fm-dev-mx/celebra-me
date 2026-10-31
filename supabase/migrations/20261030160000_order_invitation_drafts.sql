-- One durable invitation per order; creation and linkage share a transaction.
-- The function and its initial permissions come first so the revoke is provably initial.
begin;

create function public.create_order_invitation_draft(
  p_order_id uuid, p_expected_request_updated_at timestamptz,
  p_slug text, p_theme_id text, p_content jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.sales_orders%rowtype;
  v_request public.invitation_data_requests%rowtype;
  v_customer public.customers%rowtype;
  v_invitation_id uuid;
begin
  select * into v_order from public.sales_orders where id = p_order_id for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  -- Check before snapshot validation: retries must never rewrite an edited draft.
  if v_order.invitation_id is not null then
    if not exists (select 1 from public.invitations i
      join public.invitation_content_drafts d on d.invitation_project_id = i.id
      where i.id = v_order.invitation_id and i.archived_at is null and d.deleted_at is null)
    then return jsonb_build_object('error', 'unavailable'); end if;
    return jsonb_build_object('invitationId', v_order.invitation_id, 'created', false);
  end if;
  if v_order.status not in ('deposit_paid', 'paid') then
    return jsonb_build_object('error', 'unpaid');
  end if;
  select * into v_request from public.invitation_data_requests
    where order_id = p_order_id for share;
  if not found or v_request.status <> 'submitted' or v_request.submitted_at is null then
    return jsonb_build_object('error', 'not_submitted');
  end if;
  if v_request.updated_at is distinct from p_expected_request_updated_at then
    return jsonb_build_object('error', 'stale');
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_theme_id is null or length(trim(p_theme_id)) = 0
    or jsonb_typeof(p_content) is distinct from 'object'
    or p_content->>'eventType' is distinct from v_order.event_type
    or nullif(trim(p_content->>'title'), '') is null then
    return jsonb_build_object('error', 'invalid_content');
  end if;
  select * into strict v_customer from public.customers where id = v_order.customer_id;
  insert into public.invitations
    (kind, slug, title, event_type, theme_id, client_name, client_email,
     client_whatsapp, photos_received, status)
  values ('client', p_slug, p_content->>'title', v_order.event_type, p_theme_id,
    v_customer.display_name, coalesce(v_customer.email, ''),
    coalesce(v_customer.phone_e164, ''),
    jsonb_array_length(coalesce(v_request.answers->'photos', '[]'::jsonb)) > 0, 'draft')
  returning id into v_invitation_id;
  insert into public.invitation_content_drafts (invitation_project_id, content, status)
  values (v_invitation_id, p_content || jsonb_build_object('orderSource', jsonb_build_object(
    'orderId', p_order_id, 'packageName', v_order.package_name, 'answers', v_request.answers)), 'draft');
  update public.sales_orders set invitation_id = v_invitation_id where id = p_order_id;
  return jsonb_build_object('invitationId', v_invitation_id, 'created', true);
end;
$$;

revoke all on function public.create_order_invitation_draft(uuid, timestamptz, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_order_invitation_draft(uuid, timestamptz, text, text, jsonb)
  to service_role;

alter table public.sales_orders
  add column invitation_id uuid unique references public.invitations(id) on delete restrict;

grant insert (kind, slug, title, event_type, theme_id, client_name, client_email,
  client_whatsapp, photos_received, status) on public.invitations to service_role;
grant insert (invitation_project_id, content, status) on public.invitation_content_drafts to service_role;

commit;
