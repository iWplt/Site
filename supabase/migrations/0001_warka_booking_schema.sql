create extension if not exists "pgcrypto";

create type public.app_role as enum ('OWNER', 'REPRESENTATIVE');
create type public.batch_status as enum ('draft', 'active', 'closed', 'archived');
create type public.form_type as enum ('BATCH', 'INDIVIDUAL');
create type public.form_status as enum ('draft', 'published', 'closed', 'archived');
create type public.access_code_status as enum ('ACTIVE', 'USED', 'DISABLED', 'EXPIRED');
create type public.order_status as enum ('SUBMITTED', 'REVIEWED', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'REPRESENTATIVE',
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  university text not null,
  college text not null,
  department text not null,
  stage text not null,
  graduation_year int not null,
  description text,
  representative_id uuid references public.profiles(id),
  status public.batch_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  full_name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, full_name)
);

create table public.booking_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  internal_description text,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  type public.form_type not null,
  status public.form_status not null default 'draft',
  batch_id uuid references public.batches(id),
  opening_date timestamptz,
  closing_date timestamptz,
  definition jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_sections (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.booking_forms(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0
);

create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.form_sections(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null,
  required boolean not null default false,
  locked boolean not null default false,
  default_value jsonb,
  description text,
  placeholder text,
  sort_order int not null default 0,
  config jsonb not null default '{}'::jsonb,
  unique (section_id, key)
);

create table public.form_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.form_fields(id) on delete cascade,
  parent_option_id uuid references public.form_field_options(id) on delete cascade,
  label text not null,
  value text not null,
  description text,
  image_path text,
  enabled boolean not null default true,
  sort_order int not null default 0
);

create table public.form_rules (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.booking_forms(id) on delete cascade,
  field_key text not null,
  operator text not null,
  value jsonb,
  action text not null,
  target_field_key text not null
);

create table public.batch_form_overrides (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  form_id uuid not null references public.booking_forms(id) on delete cascade,
  field_key text not null,
  visible boolean,
  required boolean,
  locked boolean,
  default_value jsonb,
  choices jsonb,
  unique (batch_id, form_id, field_key)
);

create table public.student_access_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  form_id uuid not null references public.booking_forms(id) on delete cascade,
  code_ciphertext text not null,
  code_fingerprint text not null,
  status public.access_code_status not null default 'ACTIVE',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, code_fingerprint)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.booking_forms(id),
  batch_id uuid references public.batches(id),
  student_id uuid references public.students(id),
  access_code_id uuid references public.student_access_codes(id),
  booking_number text not null unique,
  status public.order_status not null default 'SUBMITTED',
  is_current boolean not null default true,
  answers jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reopened_from uuid references public.submissions(id)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  old_status public.order_status,
  new_status public.order_status not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  notes text
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_label text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create view public.student_overview as
select
  s.*,
  b.name as batch_name,
  b.graduation_year,
  b.representative_id,
  ac.status as code_status,
  ac.code_ciphertext,
  sub.booking_number,
  case when sub.id is null then 'pending' else 'submitted' end as submission_status,
  sub.status as order_status
from public.students s
join public.batches b on b.id = s.batch_id
left join lateral (
  select *
  from public.student_access_codes c
  where c.student_id = s.id
  order by c.created_at desc
  limit 1
) ac on true
left join lateral (
  select *
  from public.submissions ss
  where ss.student_id = s.id and ss.is_current
  order by ss.submitted_at desc
  limit 1
) sub on true;

create view public.submission_overview as
select
  sub.id,
  sub.booking_number,
  coalesce(st.full_name, sub.answers ->> 'student_name') as student_name,
  f.name as form_name,
  b.name as batch_name,
  b.representative_id,
  sub.status,
  sub.submitted_at
from public.submissions sub
join public.booking_forms f on f.id = sub.form_id
left join public.batches b on b.id = sub.batch_id
left join public.students st on st.id = sub.student_id;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and disabled = false
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'OWNER'
$$;

create or replace function public.can_access_batch(batch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
    or exists (
      select 1 from public.batches
      where id = batch_uuid and representative_id = auth.uid()
    )
$$;

create or replace function public.next_booking_number(p_batch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_year int;
  next_num int;
begin
  select coalesce(graduation_year, extract(year from now())::int) into batch_year
  from public.batches where id = p_batch_id;

  select count(*) + 1 into next_num
  from public.submissions
  where batch_id = p_batch_id;

  return 'WK-' || coalesce(batch_year, extract(year from now())::int) || '-' || lpad(next_num::text, 5, '0');
end;
$$;

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
  values (p_form_id, p_batch_id, p_student_id, p_access_code_id, booking, p_answers, p_files)
  returning id into submission_id;

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

create or replace function public.regenerate_student_access_code(
  p_student_id uuid,
  p_form_id uuid,
  p_batch_id uuid,
  p_code_ciphertext text,
  p_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.can_access_batch(p_batch_id) then
    raise exception 'غير مصرح بالوصول إلى هذه الدفعة.';
  end if;

  update public.student_access_codes
  set status = 'DISABLED', updated_at = now()
  where student_id = p_student_id and form_id = p_form_id and status = 'ACTIVE';

  insert into public.student_access_codes (student_id, form_id, batch_id, code_ciphertext, code_fingerprint, status)
  values (p_student_id, p_form_id, p_batch_id, p_code_ciphertext, p_fingerprint, 'ACTIVE')
  returning id into new_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ACCESS_CODE_REGENERATED', 'student_access_code', new_id, jsonb_build_object('student_id', p_student_id));

  return new_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.booking_forms enable row level security;
alter table public.form_sections enable row level security;
alter table public.form_fields enable row level security;
alter table public.form_field_options enable row level security;
alter table public.form_rules enable row level security;
alter table public.batch_form_overrides enable row level security;
alter table public.student_access_codes enable row level security;
alter table public.submissions enable row level security;
alter table public.order_status_history enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles owner read all or self" on public.profiles for select using (public.is_owner() or id = auth.uid());
create policy "profiles owner manage" on public.profiles for all using (public.is_owner()) with check (public.is_owner());

create policy "batches scoped read" on public.batches for select using (public.can_access_batch(id));
create policy "batches owner manage" on public.batches for all using (public.is_owner()) with check (public.is_owner());

create policy "students scoped read" on public.students for select using (public.can_access_batch(batch_id));
create policy "students scoped insert" on public.students for insert with check (public.can_access_batch(batch_id));
create policy "students scoped update" on public.students for update using (public.can_access_batch(batch_id)) with check (public.can_access_batch(batch_id));
create policy "students owner delete" on public.students for delete using (public.is_owner());

create policy "forms owner manage" on public.booking_forms for all using (public.is_owner()) with check (public.is_owner());
create policy "forms reps read published assigned" on public.booking_forms for select using (status = 'published' and (batch_id is null or public.can_access_batch(batch_id)));

create policy "form builder owner manage sections" on public.form_sections for all using (public.is_owner()) with check (public.is_owner());
create policy "form builder owner manage fields" on public.form_fields for all using (public.is_owner()) with check (public.is_owner());
create policy "form builder owner manage options" on public.form_field_options for all using (public.is_owner()) with check (public.is_owner());
create policy "form builder owner manage rules" on public.form_rules for all using (public.is_owner()) with check (public.is_owner());
create policy "overrides scoped read" on public.batch_form_overrides for select using (public.can_access_batch(batch_id));
create policy "overrides owner manage" on public.batch_form_overrides for all using (public.is_owner()) with check (public.is_owner());

create policy "codes scoped read" on public.student_access_codes for select using (public.can_access_batch(batch_id));
create policy "codes scoped update" on public.student_access_codes for update using (public.can_access_batch(batch_id)) with check (public.can_access_batch(batch_id));
create policy "codes owner insert" on public.student_access_codes for insert with check (public.is_owner() or public.can_access_batch(batch_id));

create policy "submissions scoped read" on public.submissions for select using (batch_id is null or public.can_access_batch(batch_id));
create policy "submissions owner update" on public.submissions for update using (public.is_owner()) with check (public.is_owner());

create policy "status history scoped read" on public.order_status_history for select using (
  exists (select 1 from public.submissions s where s.id = submission_id and (s.batch_id is null or public.can_access_batch(s.batch_id)))
);
create policy "status history owner insert" on public.order_status_history for insert with check (public.is_owner());

create policy "audit owner read" on public.audit_logs for select using (public.is_owner());
create policy "audit owner insert" on public.audit_logs for insert with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-uploads', 'booking-uploads', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
