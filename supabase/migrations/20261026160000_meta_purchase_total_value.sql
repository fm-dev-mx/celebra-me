-- Value new deposit Purchases at the full order total, while recording the actual payment.
-- Existing outbox rows (including pending deliveries and idempotent retries) are unchanged.
-- RPC signature, row lock, stable event ID and service-role-only privileges are preserved.

begin;

create or replace function public.register_commercial_deposit_purchase(
  p_order_id uuid,
  p_amount_paid numeric,
  p_actor_id uuid,
  p_paid_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_order public.sales_orders%rowtype;
  v_conversion public.meta_conversion_events%rowtype;
  v_event_id text;
  v_key text := nullif(trim(p_idempotency_key), '');
begin
  if p_amount_paid is null or p_amount_paid <= 0 then
    raise exception using errcode = '22023', message = 'El monto del anticipo debe ser mayor a cero.';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception using errcode = '22023', message = 'La clave de idempotencia del anticipo es obligatoria.';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró la orden de venta.';
  end if;
  if p_amount_paid > v_order.total_amount then
    raise exception using errcode = '22023', message = 'El anticipo no puede ser mayor que el monto total de la orden.';
  end if;

  v_event_id := 'purchase:' || p_order_id::text || ':deposit_paid';

  if v_order.status in ('deposit_paid', 'paid') then
    if v_order.amount_paid <> p_amount_paid or v_order.deposit_idempotency_key is distinct from v_key then
      raise exception using errcode = '40001', message = 'La orden ya tiene un anticipo registrado con datos diferentes.';
    end if;
    select * into v_conversion
    from public.meta_conversion_events
    where event_id = v_event_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La orden pagada no tiene su evento Purchase asociado.';
    end if;
    return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', to_jsonb(v_conversion), 'idempotent', true);
  end if;

  if v_order.status not in ('quoted', 'confirmed') then
    raise exception using errcode = '22023', message = format('No se puede registrar un anticipo en una orden con estado "%s".', v_order.status);
  end if;

  update public.sales_orders
  set status = 'deposit_paid',
      amount_paid = p_amount_paid,
      deposit_paid_at = coalesce(p_paid_at, now()),
      deposit_idempotency_key = v_key,
      deposit_recorded_by = p_actor_id
  where id = p_order_id
  returning * into v_order;

  insert into public.meta_conversion_events (
    order_id, lead_id, customer_id, event_name, event_id,
    trigger_status, value, currency, status
  ) values (
    v_order.id, v_order.lead_id, v_order.customer_id, 'Purchase', v_event_id,
    'deposit_paid', v_order.total_amount, 'MXN', 'pending'
  )
  on conflict (event_id) do nothing
  returning * into v_conversion;

  if v_conversion.id is null then
    select * into v_conversion
    from public.meta_conversion_events
    where event_id = v_event_id;
    if v_conversion.order_id <> v_order.id
      or v_conversion.value <> v_order.total_amount
      or v_conversion.currency <> 'MXN' then
      raise exception using errcode = '40001', message = 'El evento Purchase existente no coincide con el anticipo.';
    end if;
  end if;

  return jsonb_build_object('order', to_jsonb(v_order), 'conversion_event', to_jsonb(v_conversion), 'idempotent', false);
end;
$$;

commit;
