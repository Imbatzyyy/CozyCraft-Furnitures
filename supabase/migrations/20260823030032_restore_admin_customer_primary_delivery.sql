
    create or replace function public.admin_customer_directory()
    returns table (
      id uuid,
      full_name text,
      email text,
      phone text,
      avatar_url text,
      username text,
      gender text,
      date_of_birth date,
      role public.user_role,
      staff_active boolean,
      created_at timestamptz,
      primary_address jsonb,
      address_count bigint,
      order_count bigint,
      support_ticket_count bigint
    )
    language sql
    stable
    security definer
    set search_path = ''
    as $function$
      select
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.avatar_url,
        p.username,
        p.gender,
        p.date_of_birth,
        p.role,
        p.staff_active,
        p.created_at,
        (
          select jsonb_build_object(
            'id', a.id,
            'label', a.label,
            'recipient_name', a.recipient_name,
            'mobile', a.mobile,
            'email', a.email,
            'address_line', a.address_line,
            'barangay', a.barangay,
            'city', a.city,
            'province', a.province,
            'postal_code', a.postal_code,
            'delivery_note', a.delivery_note,
            'is_primary', a.is_primary
          )
          from public.addresses a
          where a.user_id = p.id
          order by a.is_primary desc, a.created_at desc
          limit 1
        ) as primary_address,
        (select count(*) from public.addresses a where a.user_id = p.id) as address_count,
        (select count(*) from public.orders o where o.user_id = p.id) as order_count,
        (select count(*) from public.support_tickets t where t.user_id = p.id) as support_ticket_count
      from public.profiles p
      where (select auth.uid()) is not null
        and (select private.is_admin())
        and p.role = 'customer';
    $function$;

    revoke all on function public.admin_customer_directory() from public, anon, authenticated;
    grant execute on function public.admin_customer_directory() to authenticated;

    comment on function public.admin_customer_directory() is
      'Admin-only customer directory. Returns one preferred primary address per customer plus aggregate counts; authorization is enforced by private.is_admin().';
  ;
