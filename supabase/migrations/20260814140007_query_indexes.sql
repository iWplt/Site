-- Indexes matching current WARKA list/filter/join patterns.
-- Do not edit 0001–0006.

create index if not exists students_batch_id_idx
  on public.students (batch_id);

create index if not exists submissions_batch_submitted_idx
  on public.submissions (batch_id, submitted_at desc);

create index if not exists submissions_student_current_idx
  on public.submissions (student_id, is_current);

create index if not exists submissions_status_current_idx
  on public.submissions (status)
  where is_current;

create index if not exists submissions_booking_number_idx
  on public.submissions (booking_number);

create index if not exists student_access_codes_student_created_idx
  on public.student_access_codes (student_id, created_at desc);

create index if not exists booking_forms_batch_id_idx
  on public.booking_forms (batch_id);

create index if not exists representative_batches_rep_idx
  on public.representative_batches (representative_id);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'fixed_option_config'
  ) then
    execute 'create index if not exists fixed_option_config_form_id_idx on public.fixed_option_config (form_id)';
  end if;
end $$;
