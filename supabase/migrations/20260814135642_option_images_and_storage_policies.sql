-- Owner-managed product/option reference images + hardened storage policies
-- Option reference images are SEPARATE from student design attachments.

alter table public.form_field_options
  add column if not exists image_alt text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.form_field_options.image_path is
  'Supabase Storage path for Owner-uploaded option reference image (NOT student designs).';
comment on column public.form_field_options.image_alt is
  'Accessible alt text for the option reference image.';

-- Private bucket for Owner product/option reference images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'form-options',
  'form-options',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Ensure booking-uploads remains private
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'booking-uploads';

-- Drop overly permissive submission_files insert (RPC is security definer and bypasses RLS)
drop policy if exists "submission files service insert" on public.submission_files;

-- Storage: Owners manage form-options; authenticated staff with batch access read booking uploads;
-- public never gets unrestricted listing. Uploads for booking path go through service role / signed URLs.

drop policy if exists "form options owner read" on storage.objects;
drop policy if exists "form options owner write" on storage.objects;
drop policy if exists "form options owner update" on storage.objects;
drop policy if exists "form options owner delete" on storage.objects;
drop policy if exists "booking uploads scoped read" on storage.objects;
drop policy if exists "booking uploads owner manage" on storage.objects;

create policy "form options owner read"
  on storage.objects for select
  using (bucket_id = 'form-options' and public.is_owner());

create policy "form options owner write"
  on storage.objects for insert
  with check (bucket_id = 'form-options' and public.is_owner());

create policy "form options owner update"
  on storage.objects for update
  using (bucket_id = 'form-options' and public.is_owner())
  with check (bucket_id = 'form-options' and public.is_owner());

create policy "form options owner delete"
  on storage.objects for delete
  using (bucket_id = 'form-options' and public.is_owner());

-- Path convention for student designs: booking-uploads/{batchId}/{studentId}/{fieldKey}/{file}
-- Representatives may read objects whose first path segment is an assigned batch id.
create policy "booking uploads scoped read"
  on storage.objects for select
  using (
    bucket_id = 'booking-uploads'
    and (
      public.is_owner()
      or public.can_access_batch(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "booking uploads owner manage"
  on storage.objects for all
  using (bucket_id = 'booking-uploads' and public.is_owner())
  with check (bucket_id = 'booking-uploads' and public.is_owner());

-- Public published form read (slug lookup for access-code gate) without exposing drafts
drop policy if exists "forms public read published by slug" on public.booking_forms;
create policy "forms public read published by slug"
  on public.booking_forms for select
  using (status = 'published');

-- Verify access code via security-definer RPC (no fingerprint enumeration of ciphertext)
create or replace function public.verify_access_code(
  p_slug text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  form_row public.booking_forms%rowtype;
  code_row public.student_access_codes%rowtype;
  student_row public.students%rowtype;
begin
  select * into form_row
  from public.booking_forms
  where slug = p_slug and status = 'published';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into code_row
  from public.student_access_codes
  where form_id = form_row.id and code_fingerprint = p_fingerprint
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if code_row.status = 'USED' then
    return jsonb_build_object('ok', false, 'error', 'used');
  end if;

  if code_row.status <> 'ACTIVE' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into student_row from public.students where id = code_row.student_id;
  if not found or student_row.batch_id <> code_row.batch_id then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  if exists (
    select 1 from public.submissions
    where student_id = student_row.id and form_id = form_row.id and is_current
  ) then
    return jsonb_build_object('ok', false, 'error', 'used');
  end if;

  return jsonb_build_object(
    'ok', true,
    'formId', form_row.id,
    'slug', form_row.slug,
    'formType', form_row.type,
    'batchId', form_row.batch_id,
    'accessCodeId', code_row.id,
    'studentId', student_row.id,
    'studentName', student_row.full_name
  );
end;
$$;

revoke all on function public.verify_access_code(text, text) from public;
grant execute on function public.verify_access_code(text, text) to anon, authenticated, service_role;

-- Allow status history inserts from representatives for permitted transitions (enforced in app)
drop policy if exists "status history scoped insert" on public.order_status_history;
create policy "status history scoped insert"
  on public.order_status_history for insert
  with check (
    public.is_owner()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.batch_id is not null and public.can_access_batch(s.batch_id)
    )
  );

drop policy if exists "submissions scoped status update" on public.submissions;
create policy "submissions scoped status update"
  on public.submissions for update
  using (public.is_owner() or (batch_id is not null and public.can_access_batch(batch_id)))
  with check (public.is_owner() or (batch_id is not null and public.can_access_batch(batch_id)));
