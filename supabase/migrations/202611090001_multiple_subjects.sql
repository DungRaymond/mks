-- Một task có thể thuộc nhiều môn: subjects text[] thay cho cột subject đơn.

alter table public.class_items
  add column if not exists subjects text[] not null default '{}';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'class_items' and column_name = 'subject'
  ) then
    execute $sql$
      update public.class_items
      set subjects = array[btrim(subject)]
      where subject is not null and btrim(subject) <> '' and cardinality(subjects) = 0
    $sql$;
    execute 'alter table public.class_items drop column subject';
  end if;
end $$;

create or replace function public.save_class_item(payload jsonb, p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_image_count integer;
  v_images_changed boolean;
  v_images jsonb;
  v_image jsonb;
  v_name text;
  v_is_new boolean;
  v_subjects text[];
begin
  if not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('app.profile_id', p_actor_id::text, true);

  if not public.is_officer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if jsonb_typeof(payload) <> 'object'
    or nullif(btrim(payload->>'title'), '') is null
    or nullif(payload->>'type', '') is null then
    raise exception 'title and type are required' using errcode = '22023';
  end if;

  if payload ? 'subjects' and jsonb_typeof(payload->'subjects') <> 'array' then
    raise exception 'subjects must be an array of subject names' using errcode = '22023';
  end if;

  select coalesce(array_agg(subject order by ordinal), '{}') into v_subjects
  from jsonb_array_elements_text(coalesce(payload->'subjects', '[]'::jsonb))
    with ordinality as entries(subject, ordinal);

  v_images := coalesce(payload->'images', '[]'::jsonb);
  if jsonb_typeof(v_images) <> 'array' or jsonb_array_length(v_images) > 5 then
    raise exception 'images must be an array with at most 5 entries' using errcode = '22023';
  end if;

  for v_image in select value from jsonb_array_elements(v_images)
  loop
    if jsonb_typeof(v_image) <> 'object'
      or nullif(btrim(v_image->>'uc_uuid'), '') is null
      or nullif(btrim(v_image->>'cdn_url'), '') is null then
      raise exception 'each image needs uc_uuid and cdn_url' using errcode = '22023';
    end if;
    perform coalesce((v_image->>'sort_order')::integer, 0);
  end loop;

  v_image_count := jsonb_array_length(v_images);
  v_id := nullif(payload->>'id', '')::uuid;
  v_is_new := v_id is null;

  if v_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
    ) order by sort_order), '[]'::jsonb) is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uc_uuid', image->>'uc_uuid',
        'cdn_url', image->>'cdn_url',
        'sort_order', coalesce((image->>'sort_order')::integer, ordinal::integer - 1)
      ) order by ordinal), '[]'::jsonb)
      from jsonb_array_elements(v_images) with ordinality as entries(image, ordinal)
    ) into v_images_changed
    from public.item_images where item_id = v_id;
  else
    v_images_changed := v_image_count > 0;
  end if;

  if v_id is null then
    insert into public.class_items (
      type, title, description, subjects, priority, due_at,
      is_pinned, is_done, is_published, created_by
    ) values (
      (payload->>'type')::public.item_type,
      btrim(payload->>'title'),
      payload->>'description',
      v_subjects,
      coalesce(nullif(payload->>'priority', '')::public.item_priority, 'normal'),
      nullif(payload->>'due_at', '')::timestamptz,
      coalesce((payload->>'is_pinned')::boolean, false),
      coalesce((payload->>'is_done')::boolean, false),
      coalesce((payload->>'is_published')::boolean, true),
      p_actor_id
    ) returning id into v_id;
  else
    update public.class_items set
      type = (payload->>'type')::public.item_type,
      title = btrim(payload->>'title'),
      description = payload->>'description',
      subjects = v_subjects,
      priority = coalesce(nullif(payload->>'priority', '')::public.item_priority, 'normal'),
      due_at = nullif(payload->>'due_at', '')::timestamptz,
      is_pinned = coalesce((payload->>'is_pinned')::boolean, false),
      is_done = coalesce((payload->>'is_done')::boolean, false),
      is_published = coalesce((payload->>'is_published')::boolean, true)
    where id = v_id;

    if not found then
      raise exception 'item not found' using errcode = 'P0002';
    end if;
  end if;

  select full_name into v_name from public.profiles where id = p_actor_id;
  perform set_config('app.suppress_item_image_history', 'on', true);
  delete from public.item_images where item_id = v_id;

  insert into public.item_images (item_id, uc_uuid, cdn_url, sort_order)
  select
    v_id,
    image->>'uc_uuid',
    image->>'cdn_url',
    coalesce((image->>'sort_order')::integer, ordinal::integer - 1)
  from jsonb_array_elements(v_images) with ordinality as entries(image, ordinal);

  if v_is_new then
    update public.class_item_history set
      changed_fields = case when v_image_count > 0 then array_append(changed_fields, 'images') else changed_fields end,
      images_snapshot = (select coalesce(jsonb_agg(jsonb_build_object(
        'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
      ) order by sort_order), '[]'::jsonb) from public.item_images where item_id = v_id)
    where item_id = v_id and action = 'insert' and changed_by = p_actor_id
      and changed_at >= transaction_timestamp();
  elsif v_images_changed then
    insert into public.class_item_history
      (item_id, action, changed_by, changed_by_name, changed_fields, images_snapshot)
    values (
      v_id, 'update', p_actor_id, v_name, array['images'],
      (select coalesce(jsonb_agg(jsonb_build_object(
        'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
      ) order by sort_order), '[]'::jsonb)
      from public.item_images where item_id = v_id)
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.restore_class_item(p_history_id bigint, p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.class_item_history%rowtype;
  v_data jsonb;
  v_image jsonb;
  v_item_exists boolean;
  v_subjects text[];
begin
  if not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('app.profile_id', p_actor_id::text, true);

  if not public.is_officer() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into h from public.class_item_history where id = p_history_id;
  if not found then
    raise exception 'history entry not found' using errcode = 'P0002';
  end if;

  if h.action = 'insert' then
    raise exception 'insert history cannot be restored' using errcode = '22023';
  end if;

  v_data := h.old_data;
  if v_data is null and not ('images' = any(h.changed_fields)) then
    raise exception 'history entry has no item snapshot' using errcode = '22023';
  end if;

  -- Snapshot cũ hơn migration này vẫn còn khoá `subject` dạng text.
  if jsonb_typeof(v_data->'subjects') = 'array' then
    select coalesce(array_agg(subject order by ordinal), '{}') into v_subjects
    from jsonb_array_elements_text(v_data->'subjects') with ordinality as entries(subject, ordinal);
  elsif nullif(btrim(v_data->>'subject'), '') is not null then
    v_subjects := array[btrim(v_data->>'subject')];
  else
    v_subjects := '{}';
  end if;

  select exists(select 1 from public.class_items where id = h.item_id) into v_item_exists;
  if v_data is not null and not v_item_exists then
    insert into public.class_items (
      id, type, title, description, subjects, priority, due_at,
      is_pinned, is_done, is_published, created_by, created_at, updated_at
    ) values (
      h.item_id,
      (v_data->>'type')::public.item_type,
      v_data->>'title', v_data->>'description', v_subjects,
      (v_data->>'priority')::public.item_priority,
      nullif(v_data->>'due_at', '')::timestamptz,
      coalesce((v_data->>'is_pinned')::boolean, false),
      coalesce((v_data->>'is_done')::boolean, false),
      coalesce((v_data->>'is_published')::boolean, true),
      p_actor_id,
      coalesce(nullif(v_data->>'created_at', '')::timestamptz, now()), now()
    );
  elsif v_data is not null then
    update public.class_items set
      type = (v_data->>'type')::public.item_type,
      title = v_data->>'title',
      description = v_data->>'description',
      subjects = v_subjects,
      priority = (v_data->>'priority')::public.item_priority,
      due_at = nullif(v_data->>'due_at', '')::timestamptz,
      is_pinned = coalesce((v_data->>'is_pinned')::boolean, false),
      is_done = coalesce((v_data->>'is_done')::boolean, false),
      is_published = coalesce((v_data->>'is_published')::boolean, true)
    where id = h.item_id;
  end if;

  perform set_config('app.suppress_item_image_history', 'on', true);
  delete from public.item_images where item_id = h.item_id;
  for v_image in select value from jsonb_array_elements(coalesce(h.images_snapshot, '[]'::jsonb))
  loop
    insert into public.item_images (item_id, uc_uuid, cdn_url, sort_order)
    values (
      h.item_id,
      v_image->>'uc_uuid',
      v_image->>'cdn_url',
      coalesce((v_image->>'sort_order')::integer, 0)
    );
  end loop;

  return h.item_id;
end;
$$;

revoke all on function public.save_class_item(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_class_item(jsonb, uuid) to service_role;
revoke all on function public.restore_class_item(bigint, uuid) from public, anon, authenticated;
grant execute on function public.restore_class_item(bigint, uuid) to service_role;