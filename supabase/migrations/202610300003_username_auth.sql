-- Move staff credentials and sessions out of Supabase Auth.
do $$
begin
  if exists (select 1 from public.profiles) then
    raise exception 'profiles is not empty; migrate existing officers to usernames/password hashes before applying this migration';
  end if;
end $$;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists password_hash text;
alter table public.profiles alter column username drop not null;
alter table public.profiles alter column password_hash drop not null;
alter table public.profiles alter column username set not null;
alter table public.profiles alter column password_hash set not null;
create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username));
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,32}$');

create table if not exists public.auth_sessions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_expires_at_idx on public.auth_sessions (expires_at);
alter table public.auth_sessions enable row level security;
revoke all on public.auth_sessions from anon, authenticated;

-- Required for this project's server-side username auth. Service-role key must never reach clients.
grant all on public.auth_sessions to service_role;

-- Public reads stay available; all writes now pass through server-side authorized code.
revoke insert, update, delete on public.profiles, public.class_items,
  public.item_images, public.class_item_history from anon, authenticated;
revoke all on function public.save_class_item(jsonb) from public, anon, authenticated;
revoke all on function public.restore_class_item(bigint) from public, anon, authenticated;
grant execute on function public.save_class_item(jsonb) to service_role;
grant execute on function public.restore_class_item(bigint) to service_role;

-- App-level actor is set only by server-side service-role RPC calls.
create or replace function public.is_officer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id::text = nullif(current_setting('app.profile_id', true), '')
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id::text = nullif(current_setting('app.profile_id', true), '') and role = 'admin'
  );
$$;

create or replace function public.log_class_item_change()
returns trigger language plpgsql security definer set search_path = '' as $$
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
    v_new := to_jsonb(new); v_item := new.id;
    v_fields := array(select jsonb_object_keys(v_new));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_item := new.id;
    select coalesce(array_agg(k), '{}') into v_fields
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and v_new->k is distinct from v_old->k;
    if cardinality(v_fields) = 0 then return new; end if;
  else
    v_old := to_jsonb(old); v_item := old.id;
  end if;
  insert into public.class_item_history
    (item_id, action, changed_by, changed_by_name, old_data, new_data, changed_fields,
     images_snapshot)
  values (
    v_item, lower(tg_op)::public.history_action, v_actor, v_name, v_old, v_new, v_fields,
    (select coalesce(jsonb_agg(jsonb_build_object(
      'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
    ) order by sort_order), '[]'::jsonb) from public.item_images where item_id = v_item)
  );
  return coalesce(new, old);
end $$;

create or replace function public.log_item_images_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
  v_actor uuid := nullif(current_setting('app.profile_id', true), '')::uuid;
  v_name text;
begin
  if current_setting('app.suppress_item_image_history', true) = 'on'
    or not exists (select 1 from public.class_items where id = v_item) then
    return coalesce(new, old);
  end if;
  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.class_item_history
    (item_id, action, changed_by, changed_by_name, changed_fields, images_snapshot)
  values (
    v_item, 'update', v_actor, v_name, array['images'],
    (select coalesce(jsonb_agg(jsonb_build_object(
      'uc_uuid', uc_uuid, 'cdn_url', cdn_url, 'sort_order', sort_order
    ) order by sort_order), '[]'::jsonb) from public.item_images where item_id = v_item)
  );
  return coalesce(new, old);
end $$;

do $$
declare
  v_def text;
  v_actor text := 'nullif(current_setting(''app.profile_id'', true), '''')::uuid';
begin
  v_def := pg_get_functiondef('public.save_class_item(jsonb)'::regprocedure);
  v_def := replace(v_def,
    'FUNCTION public.save_class_item(payload jsonb)',
    'FUNCTION public.save_class_item(payload jsonb, p_actor_id uuid)');
  v_def := regexp_replace(v_def, 'AS \$function\$', 'AS $function$', '');
  v_def := replace(v_def, 'auth.uid()', v_actor);
  v_def := replace(v_def, E'begin\n', E'begin\n  if not exists (select 1 from public.profiles where id = p_actor_id) then raise exception ''forbidden'' using errcode = ''42501''; end if;\n  perform set_config(''app.profile_id'', p_actor_id::text, true);\n');
  execute v_def;

  v_def := pg_get_functiondef('public.restore_class_item(bigint)'::regprocedure);
  v_def := replace(v_def,
    'FUNCTION public.restore_class_item(p_history_id bigint)',
    'FUNCTION public.restore_class_item(p_history_id bigint, p_actor_id uuid)');
  v_def := replace(v_def, 'auth.uid()', v_actor);
  v_def := replace(v_def, E'begin\n', E'begin\n  if not exists (select 1 from public.profiles where id = p_actor_id) then raise exception ''forbidden'' using errcode = ''42501''; end if;\n  perform set_config(''app.profile_id'', p_actor_id::text, true);\n');
  execute v_def;
end $$;

revoke all on function public.save_class_item(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_class_item(jsonb, uuid) to service_role;
revoke all on function public.restore_class_item(bigint, uuid) from public, anon, authenticated;
grant execute on function public.restore_class_item(bigint, uuid) to service_role;
