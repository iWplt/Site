-- Globally unique booking numbers. Do not edit 0001–0009.
-- 0008 serializes per batch_id, but booking_number is unique across all batches
-- that share a year prefix (WK-2027-*). Allocate from the prefix, not the batch row count.

create or replace function public.next_booking_number(p_batch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_year int;
  prefix text;
  next_num int;
begin
  if p_batch_id is null then
    prefix := 'WK-IND-';
  else
    select coalesce(graduation_year, extract(year from now())::int) into batch_year
    from public.batches where id = p_batch_id;
    prefix := 'WK-' || coalesce(batch_year, extract(year from now())::int)::text || '-';
  end if;

  perform pg_advisory_xact_lock(87931401, hashtext('warka-booking-prefix:' || prefix));

  select coalesce(max(substring(booking_number from '[0-9]+$')::int), 0) + 1
    into next_num
  from public.submissions
  where booking_number like prefix || '%';

  return prefix || lpad(next_num::text, 5, '0');
end;
$$;

revoke execute on function public.next_booking_number(uuid) from public, anon, authenticated;
grant execute on function public.next_booking_number(uuid) to service_role;
