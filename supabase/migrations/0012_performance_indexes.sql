-- Proposed performance indexes and RLS initplan helpers.
-- DO NOT apply until local/live migration history is reconciled.
-- Do not run `supabase db push` with this file until that workflow is ready.

-- Unindexed foreign keys reported by Supabase Performance Advisor.
create index if not exists submissions_form_id_idx
  on public.submissions (form_id);

create index if not exists submissions_access_code_id_idx
  on public.submissions (access_code_id);

create index if not exists student_access_codes_batch_id_idx
  on public.student_access_codes (batch_id);

create index if not exists booking_forms_created_by_idx
  on public.booking_forms (created_by);

create index if not exists batches_representative_id_idx
  on public.batches (representative_id);

create index if not exists representative_batches_batch_id_idx
  on public.representative_batches (batch_id);

create index if not exists order_status_history_submission_id_idx
  on public.order_status_history (submission_id);

create index if not exists order_status_history_changed_by_idx
  on public.order_status_history (changed_by);

-- Initplan-friendly helpers. Semantics stay identical: still auth.uid() of the caller.
create or replace function private.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, private
as $$
  select role from public.profiles where id = (select auth.uid()) and disabled = false
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_profile_role() = 'OWNER'
$$;

create or replace function private.can_access_batch(batch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_owner()
    or exists (
      select 1 from public.batches
      where id = batch_uuid and representative_id = (select auth.uid())
    )
    or exists (
      select 1 from public.representative_batches
      where batch_id = batch_uuid and representative_id = (select auth.uid())
    )
$$;
