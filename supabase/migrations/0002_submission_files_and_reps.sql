-- Relational submission files + representative phone/email helpers
create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  field_key text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists submission_files_submission_id_idx on public.submission_files(submission_id);
create index if not exists submission_files_field_key_idx on public.submission_files(field_key);

alter table public.profiles
  add column if not exists phone text,
  add column if not exists email text;

create table if not exists public.representative_batches (
  representative_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  primary key (representative_id, batch_id)
);

alter table public.submission_files enable row level security;

create policy "submission files scoped read" on public.submission_files for select using (
  exists (
    select 1
    from public.submissions s
    where s.id = submission_id
      and (s.batch_id is null or public.can_access_batch(s.batch_id))
  )
);

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
    or exists (
      select 1 from public.representative_batches
      where batch_id = batch_uuid and representative_id = auth.uid()
    )
$$;
