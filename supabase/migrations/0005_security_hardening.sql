-- Security hardening after applying the initial WARKA schema.
-- Keep RLS helper functions available to authenticated policies without exposing them as public RPC endpoints.

create schema if not exists private;
revoke all on schema private from public;

aLTER VIEW public.student_overview SET (security_invoker = true);
ALTER VIEW public.submission_overview SET (security_invoker = true);

-- representative_batches is exposed through public/PostgREST and must be protected by RLS.
alter table public.representative_batches enable row level security;

drop policy if exists "representative batches scoped read" on public.representative_batches;
drop policy if exists "representative batches owner manage" on public.representative_batches;

create policy "representative batches scoped read"
  on public.representative_batches
  for select
  using (representative_id = auth.uid() or public.is_owner());

create policy "representative batches owner manage"
  on public.representative_batches
  for all
  using (public.is_owner())
  with check (public.is_owner());

-- Move RLS helper functions out of the exposed public API schema.
alter function public.current_profile_role() set schema private;
alter function public.is_owner() set schema private;
alter function public.can_access_batch(uuid) set schema private;

-- Refresh helper definitions so their internal references point at the private schema.
create or replace function private.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, private
as $$
  select role from public.profiles where id = auth.uid() and disabled = false
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
      where id = batch_uuid and representative_id = auth.uid()
    )
    or exists (
      select 1 from public.representative_batches
      where batch_id = batch_uuid and representative_id = auth.uid()
    )
$$;

revoke all on function private.current_profile_role() from public;
revoke all on function private.is_owner() from public;
revoke all on function private.can_access_batch(uuid) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.current_profile_role() to authenticated, service_role;
grant execute on function private.is_owner() to authenticated, service_role;
grant execute on function private.can_access_batch(uuid) to authenticated, service_role;

-- Recreate the access-code regeneration RPC to use the private RLS helper.
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
set search_path = public, private
as $$
declare
  new_id uuid;
begin
  if not private.can_access_batch(p_batch_id) then
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

-- Server-side repository calls these SECURITY DEFINER RPCs with the service-role client.
-- They do not need to be callable directly by anon/authenticated PostgREST clients.
revoke execute on function public.next_booking_number(uuid) from public, anon, authenticated;
revoke execute on function public.regenerate_student_access_code(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.submit_booking_transaction(uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.verify_access_code(text, text) from public, anon, authenticated;

grant execute on function public.next_booking_number(uuid) to service_role;
grant execute on function public.regenerate_student_access_code(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.submit_booking_transaction(uuid, uuid, uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.verify_access_code(text, text) to service_role;
