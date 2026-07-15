alter table public.students
add column if not exists tuition_fee bigint not null default 0;

alter table public.students
drop constraint if exists students_tuition_fee_nonnegative;

alter table public.students
add constraint students_tuition_fee_nonnegative
check (tuition_fee >= 0);
