create or replace function public.log_class_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_fields text[];
  v_item uuid;
  v_actor uuid := nullif(current_setting('app.profile_id', true), '')::uuid;
  v_name text;
begin
  select full_name into v_name from public.profiles where id = v_actor;
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_item := new.id;
    v_fields := array(select jsonb_object_keys(v_new));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_item := new.id;
    select coalesce(array_agg(k), '{}') into v_fields
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and v_new->k is distinct from v_old->k;
    if cardinality(v_fields) = 0 then return new; end if;
  else
    v_old := to_jsonb(old);
    v_item := old.id;
    v_fields := array(select jsonb_object_keys(v_old));
  end if;

  insert into public.class_item_history
    (item_id, action, changed_by, changed_by_name, old_data, new_data, changed_fields, images_snapshot)
  values (
    v_item,
    lower(tg_op)::public.history_action,
    v_actor,
    v_name,
    v_old,
    v_new,
    coalesce(v_fields, '{}'),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
    ) order by sort_order), '[]'::jsonb) from public.item_images where item_id = v_item)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.delete_class_item(p_item_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform set_config('app.profile_id', p_actor_id::text, true);
  delete from public.class_items where id = p_item_id;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_class_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_class_item(uuid, uuid) to service_role;
