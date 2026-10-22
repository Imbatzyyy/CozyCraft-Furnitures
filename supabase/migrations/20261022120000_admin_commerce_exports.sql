-- Compact, filtered order/payment reporting. Existing customer and mobile RPCs
-- remain compatible. SECURITY INVOKER preserves table RLS and session policies.
create or replace function public.admin_commerce_report_page(
  p_kind text, p_filters jsonb default '{}'::jsonb, p_size integer default 250,
  p_after jsonb default null, p_as_of timestamptz default null,
  p_details jsonb default '{}'::jsonb, p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  result jsonb; cutoff timestamptz:=coalesce(p_as_of,now());
  first_day date; last_day date; day_today date:=(now() at time zone 'Asia/Manila')::date;
  date_range text:=coalesce(p_filters->>'dateRange','all');
  order_state text:=coalesce(p_filters->>'status','all');
  pay_state text:=coalesce(p_filters->>'paymentStatus','all');
  method text:=coalesce(p_filters->>'paymentMethod','all');
  scope text:=coalesce(p_filters->>'scope','all');
  view_name text:=coalesce(p_filters->>'view','all');
  search_text text:=lower(trim(coalesce(p_filters->>'query','')));
  after_date timestamptz; after_id uuid;
begin
  if not coalesce(private.is_staff(),false) or not coalesce(private.customer_mfa_satisfied(),false)
    or not coalesce(private.admin_mfa_satisfied(),false) then
    raise exception 'Verified administrator session required' using errcode='42501';
  end if;
  if p_kind='payments' and not coalesce(private.is_admin(),false) then
    raise exception 'Administrator payment access required' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('orders','payments') or p_size is null or p_size not in (20,250)
    or p_page is null or p_page<1 or p_page>2500 or cutoff>now()+interval '1 minute'
    or p_filters is null or jsonb_typeof(p_filters)<>'object' or p_details is null or jsonb_typeof(p_details)<>'object'
    or order_state not in ('all','pending','processing','packed','shipped','delivered','cancelled')
    or pay_state not in ('all','pending','paid','failed','refunded') or method not in ('all','cod','gcash','card')
    or scope not in ('all','live','test','unverified')
    or view_name not in ('all','needs_fulfillment','awaiting_payment','cancellation_requests','refund_attention','returns','delivered')
    or date_range not in ('all','today','last_7_days','last_30_days','custom') or length(search_text)>150 then
    raise exception 'Invalid report filters';
  end if;
  if date_range='custom' then
    first_day:=nullif(p_filters->>'from','')::date; last_day:=nullif(p_filters->>'to','')::date;
    if first_day is null or last_day is null or first_day>last_day then raise exception 'Choose a valid start and end date'; end if;
  elsif date_range<>'all' then
    first_day:=day_today-case date_range when 'last_7_days' then 6 when 'last_30_days' then 29 else 0 end;
    last_day:=day_today;
  end if;
  if p_after is not null then
    after_date:=(p_after->>'created_at')::timestamptz; after_id:=(p_after->>'id')::uuid;
    if after_date is null or after_id is null then raise exception 'Invalid report cursor'; end if;
  end if;
  with eligible as materialized (
    select o.* from public.orders o
    where o.created_at<=cutoff
      and (order_state='all' or o.status::text=order_state)
      and (pay_state='all' or o.payment_status::text=pay_state)
      and (method='all' or lower(o.payment_method)=method)
      and (first_day is null or o.created_at>=first_day::timestamp at time zone 'Asia/Manila')
      and (last_day is null or o.created_at<(last_day+1)::timestamp at time zone 'Asia/Manila')
      and (scope='all' or (scope='unverified' and private.order_reporting_environment(o.id,o.payment_method)='unverified')
        or (scope in ('live','test') and private.reporting_order_matches(o.id,o.payment_method,scope)))
      and case view_name
        when 'needs_fulfillment' then o.status not in ('delivered','cancelled') and o.cancellation_status is distinct from 'pending' and (lower(o.payment_method)='cod' or o.payment_status='paid')
        when 'awaiting_payment' then o.status='pending' and lower(o.payment_method)<>'cod' and o.payment_status='pending'
        when 'cancellation_requests' then o.cancellation_status='pending'
        when 'refund_attention' then o.refund_status='failed'
        when 'returns' then exists(select 1 from public.return_requests r where r.order_id=o.id)
        when 'delivered' then o.status='delivered' else true end
      and (search_text='' or strpos(lower(concat_ws(' ',o.order_number,o.id,o.shipping_address->>'name',o.shipping_address->>'email',o.shipping_address->>'mobile')),search_text)>0
        or exists(select 1 from public.profiles p where p.id=o.user_id and strpos(lower(concat_ws(' ',p.full_name,p.email,p.phone)),search_text)>0)
        or exists(select 1 from public.order_items i where i.order_id=o.id and strpos(lower(i.product_name),search_text)>0))
  ), batch as materialized (
    select * from eligible o where after_date is null or (o.created_at,o.id)<(after_date,after_id)
    order by created_at desc,id desc limit p_size+1 offset case when p_after is null then (p_page-1)*p_size else 0 end
  ), page as materialized (select * from batch order by created_at desc,id desc limit p_size),
  report_rows as (
    select o.created_at,o.id,jsonb_build_object(
      'id',o.id,'order_number',o.order_number,'created_at',o.created_at,'status',o.status,
      'payment_method',o.payment_method,'payment_status',o.payment_status,'total',o.total,
      'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'discount',greatest(0,o.subtotal+o.delivery_fee-o.total),
      'shipping_address',jsonb_build_object('name',coalesce(nullif(o.shipping_address->>'name',''),(select p.full_name from public.profiles p where p.id=o.user_id),'Customer')),
      'environment',private.order_reporting_environment(o.id,o.payment_method),
      'payment_reference',case when lower(o.payment_method)='cod' then 'COD-'||o.order_number else coalesce(t.provider_payment_id,t.provider_session_id,'Not recorded') end,
      'paid_at',t.paid_at
    ) || case when coalesce((p_details->>'contact')::boolean,false) then jsonb_build_object(
      'email',coalesce(o.shipping_address->>'email',''),'mobile',coalesce(o.shipping_address->>'mobile','')) else '{}'::jsonb end
      || case when coalesce((p_details->>'address')::boolean,false) then jsonb_build_object(
        'address',concat_ws(', ',nullif(o.shipping_address->>'line',''),nullif(o.shipping_address->>'barangay',''),nullif(o.shipping_address->>'city',''),nullif(o.shipping_address->>'province',''),nullif(o.shipping_address->>'postal',''))) else '{}'::jsonb end
      || case when p_kind='orders' and coalesce((p_details->>'items')::boolean,false) then jsonb_build_object('items',coalesce((
        select jsonb_agg(jsonb_build_object('name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price) order by i.id)
        from public.order_items i where i.order_id=o.id),'[]'::jsonb)) else '{}'::jsonb end as item
    from page o left join lateral (
      select provider_payment_id,provider_session_id,paid_at from public.payment_transactions where order_id=o.id
      order by (status in ('paid','refunded')) desc,updated_at desc,id desc limit 1
    ) t on true
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(item order by created_at desc,id desc) from report_rows),'[]'::jsonb),
    'total',(select count(*) from eligible),'hasMore',(select count(*)>p_size from batch),
    'nextCursor',(select jsonb_build_object('created_at',created_at,'id',id) from page order by created_at asc,id asc limit 1),
    'asOf',cutoff,
    'snapshotKey',(select md5(coalesce(string_agg(concat_ws(':',id,status,payment_status,total,payment_method,shipping_address::text),',' order by created_at,id),'')) from eligible),
    'summary',jsonb_build_object(
      'totalValue',(select coalesce(sum(total),0) from eligible),
      'settledValue',(select coalesce(sum(total),0) from eligible where payment_status='paid' and status<>'cancelled'),
      'settledCount',(select count(*) from eligible where payment_status='paid' and status<>'cancelled'),
      'pendingValue',(select coalesce(sum(total),0) from eligible where payment_status='pending' and status<>'cancelled'),
      'refundedValue',(select coalesce(sum(total),0) from eligible where payment_status='refunded'),
      'cancelledCount',(select count(*) from eligible where status='cancelled')
    )
  ) into result;
  return result;
end $$;
revoke all on function public.admin_commerce_report_page(text,jsonb,integer,jsonb,timestamptz,jsonb,integer) from public,anon;
grant execute on function public.admin_commerce_report_page(text,jsonb,integer,jsonb,timestamptz,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
