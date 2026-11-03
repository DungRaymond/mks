alter type public.item_type add value if not exists 'announcement';

create or replace function public.set_default_class_item_due_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_at is null and new.type in ('task', 'homework') then
    new.due_at := now() + interval '7 days';
  end if;
  return new;
end;
$$;
