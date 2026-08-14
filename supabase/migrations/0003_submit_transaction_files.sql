-- Align booking RPC with relational submission_files + multi-file payloads
create or replace function public.submit_booking_transaction(
  p_form_id uuid,
  p_batch_id uuid,
  p_student_id uuid,
  p_access_code_id uuid,
  p_answers jsonb,
  p_files jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.student_access_codes%rowtype;
  booking text;
  submission_id uuid;
  student_name text;
  field_key text;
  file_item jsonb;
  sort_idx int := 0;
begin
  if p_access_code_id is not null then
    select * into code_row
    from public.student_access_codes
    where id = p_access_code_id
    for update;

    if not found or code_row.status <> 'ACTIVE' or code_row.student_id <> p_student_id or code_row.form_id <> p_form_id then
      raise exception 'رمز الحجز غير صحيح أو غير متاح.';
    end if;
  end if;

  if exists (select 1 from public.submissions where form_id = p_form_id and student_id = p_student_id and is_current) then
    raise exception 'تم استخدام رمز الحجز مسبقاً وإرسال الطلب بنجاح.';
  end if;

  booking := public.next_booking_number(p_batch_id);

  insert into public.submissions (form_id, batch_id, student_id, access_code_id, booking_number, answers, files)
  values (p_form_id, p_batch_id, p_student_id, p_access_code_id, booking, p_answers, '{}'::jsonb)
  returning id into submission_id;

  for field_key, file_item in
    select key, value
    from jsonb_each(coalesce(p_files, '{}'::jsonb))
  loop
    if jsonb_typeof(file_item) = 'array' then
      for file_item in select * from jsonb_array_elements(file_item)
      loop
        insert into public.submission_files (
          submission_id, field_key, storage_path, original_filename, mime_type, file_size, sort_order
        ) values (
          submission_id,
          field_key,
          coalesce(file_item ->> 'path', file_item ->> 'storage_path'),
          coalesce(file_item ->> 'originalName', file_item ->> 'original_filename', 'file'),
          coalesce(file_item ->> 'mimeType', file_item ->> 'mime_type', 'application/octet-stream'),
          coalesce((file_item ->> 'size')::bigint, (file_item ->> 'file_size')::bigint, 0),
          sort_idx
        );
        sort_idx := sort_idx + 1;
      end loop;
    end if;
  end loop;

  insert into public.order_status_history (submission_id, old_status, new_status)
  values (submission_id, null, 'SUBMITTED');

  update public.student_access_codes
  set status = 'USED', updated_at = now()
  where id = p_access_code_id;

  select full_name into student_name from public.students where id = p_student_id;

  insert into public.audit_logs (actor_label, action, entity_type, entity_id, metadata)
  values ('public_student_access_code', 'BOOKING_SUBMITTED', 'submission', submission_id, jsonb_build_object('booking_number', booking));

  return jsonb_build_object(
    'id', submission_id,
    'bookingNumber', booking,
    'studentName', coalesce(student_name, p_answers ->> 'student_name'),
    'status', 'SUBMITTED',
    'submittedAt', now()
  );
end;
$$;

drop policy if exists "submission files service insert" on public.submission_files;
create policy "submission files service insert"
  on public.submission_files
  for insert
  with check (true);
