alter table public.class_items
  add column if not exists is_archived boolean not null default false;
