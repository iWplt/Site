-- Individual students (nullable batch_id) + per-form/per-student fixed uniform options.
-- Do not edit 0001–0005.
-- Safe to re-run after a partial failure (e.g. CREATE OR REPLACE VIEW column-rename error).

alter table public.students
  alter column batch_id drop not null;

alter table public.students
  add column if not exists address text;

alter table public.students
  drop constraint if exists students_batch_id_full_name_key;

create unique index if not exists students_batch_full_name_idx
  on public.students (batch_id, full_name)
  where batch_id is not null;

create unique index if not exists students_individual_full_name_idx
  on public.students (full_name)
  where batch_id is null;

alter table public.student_access_codes
  alter column batch_id drop not null;

-- CREATE OR REPLACE VIEW cannot rename/reorder columns. Adding students.address via s.*
-- would shift batch_name → address. Drop and recreate instead.
drop view if exists public.student_overview;

create view public.student_overview
with (security_invoker = true)
as
select
  s.id,
  s.batch_id,
  s.full_name,
  s.phone,
  s.notes,
  s.created_at,
  s.updated_at,
  s.address,
  b.name as batch_name,
  b.graduation_year,
  b.representative_id,
  ac.status as code_status,
  ac.code_ciphertext,
  sub.booking_number,
  case when sub.id is null then 'pending' else 'submitted' end as submission_status,
  sub.status as order_status
from public.students s
left join public.batches b on b.id = s.batch_id
left join lateral (
  select c.status, c.code_ciphertext
  from public.student_access_codes c
  where c.student_id = s.id
  order by c.created_at desc
  limit 1
) ac on true
left join lateral (
  select ss.id, ss.booking_number, ss.status
  from public.submissions ss
  where ss.student_id = s.id and ss.is_current
  order by ss.submitted_at desc
  limit 1
) sub on true;

grant select on public.student_overview to anon, authenticated, service_role;

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
  if p_batch_id is null then
    select count(*) + 1 into next_num
    from public.submissions
    where batch_id is null;
    return 'WK-IND-' || lpad(next_num::text, 5, '0');
  end if;

  select coalesce(graduation_year, extract(year from now())::int) into batch_year
  from public.batches where id = p_batch_id;

  select count(*) + 1 into next_num
  from public.submissions
  where batch_id = p_batch_id;

  return 'WK-' || coalesce(batch_year, extract(year from now())::int) || '-' || lpad(next_num::text, 5, '0');
end;
$$;

revoke execute on function public.next_booking_number(uuid) from public, anon, authenticated;
grant execute on function public.next_booking_number(uuid) to service_role;

drop policy if exists "submissions scoped read" on public.submissions;
create policy "submissions scoped read" on public.submissions for select using (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "submission files scoped read" on public.submission_files;
create policy "submission files scoped read" on public.submission_files for select using (
  exists (
    select 1
    from public.submissions s
    where s.id = submission_id
      and (
        (s.batch_id is not null and private.can_access_batch(s.batch_id))
        or (s.batch_id is null and private.is_owner())
      )
  )
);

drop policy if exists "status history scoped read" on public.order_status_history;
create policy "status history scoped read" on public.order_status_history for select using (
  exists (
    select 1
    from public.submissions s
    where s.id = submission_id
      and (
        (s.batch_id is not null and private.can_access_batch(s.batch_id))
        or (s.batch_id is null and private.is_owner())
      )
  )
);

create table if not exists public.fixed_option_config (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.booking_forms(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  field_key text not null,
  option_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fixed_option_config_form_field_idx
  on public.fixed_option_config (form_id, field_key)
  where student_id is null;

create unique index if not exists fixed_option_config_student_field_idx
  on public.fixed_option_config (form_id, student_id, field_key)
  where student_id is not null;

alter table public.fixed_option_config enable row level security;

grant select, insert, update, delete on public.fixed_option_config to authenticated, service_role;

drop policy if exists "fixed options scoped read" on public.fixed_option_config;
drop policy if exists "fixed options scoped write" on public.fixed_option_config;

create policy "fixed options scoped read" on public.fixed_option_config
for select using (
  private.is_owner()
  or exists (
    select 1 from public.booking_forms f
    where f.id = form_id
      and f.batch_id is not null
      and private.can_access_batch(f.batch_id)
  )
);

create policy "fixed options scoped write" on public.fixed_option_config
for all using (
  private.is_owner()
  or (
    student_id is null
    and exists (
      select 1 from public.booking_forms f
      where f.id = form_id
        and f.batch_id is not null
        and private.can_access_batch(f.batch_id)
    )
  )
)
with check (
  private.is_owner()
  or (
    student_id is null
    and exists (
      select 1 from public.booking_forms f
      where f.id = form_id
        and f.batch_id is not null
        and private.can_access_batch(f.batch_id)
    )
  )
);

drop policy if exists "forms reps read published assigned" on public.booking_forms;
create policy "forms reps read published assigned" on public.booking_forms
for select using (
  status = 'published'
  and batch_id is not null
  and private.can_access_batch(batch_id)
);

drop policy if exists "students scoped read" on public.students;
create policy "students scoped read" on public.students for select using (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "students scoped insert" on public.students;
create policy "students scoped insert" on public.students for insert with check (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "students scoped update" on public.students;
create policy "students scoped update" on public.students for update using (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
) with check (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "codes scoped read" on public.student_access_codes;
create policy "codes scoped read" on public.student_access_codes for select using (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "codes scoped update" on public.student_access_codes;
create policy "codes scoped update" on public.student_access_codes for update using (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
) with check (
  (batch_id is not null and private.can_access_batch(batch_id))
  or (batch_id is null and private.is_owner())
);

drop policy if exists "codes owner insert" on public.student_access_codes;
create policy "codes owner insert" on public.student_access_codes for insert with check (
  (batch_id is not null and (private.is_owner() or private.can_access_batch(batch_id)))
  or (batch_id is null and private.is_owner())
);

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
  if not found or student_row.batch_id is distinct from code_row.batch_id then
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

revoke all on function public.verify_access_code(text, text) from public, anon, authenticated;
grant execute on function public.verify_access_code(text, text) to service_role;

insert into public.booking_forms (
  name,
  internal_description,
  slug,
  type,
  status,
  batch_id,
  definition
)
values (
  'حجز فردي WARKA',
  'نموذج الحجوزات الفردية بدون دفعة.',
  'individual',
  'INDIVIDUAL',
  'published',
  null,
  '{}'::jsonb
)
on conflict (slug) do nothing;
