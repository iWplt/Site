-- Access-code brute-force guard. Do not edit 0001–0008.

create table if not exists public.access_code_attempt_guard (
  bucket_hash text primary key,
  window_started_at timestamptz not null default now(),
  failed_count int not null default 0,
  cooldown_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.access_code_attempt_guard enable row level security;

revoke all on table public.access_code_attempt_guard from public, anon, authenticated;
grant select, insert, update, delete on table public.access_code_attempt_guard to service_role;

create or replace function public.check_access_code_rate_limit(
  p_bucket_hash text,
  p_event text,
  p_max_failures int default 8,
  p_window_seconds int default 900,
  p_cooldown_seconds int default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_code_attempt_guard%rowtype;
  now_ts timestamptz := now();
  event_name text := lower(coalesce(p_event, 'check'));
begin
  if p_bucket_hash is null or length(p_bucket_hash) < 16 then
    return jsonb_build_object('ok', false, 'limited', true);
  end if;

  insert into public.access_code_attempt_guard (bucket_hash, window_started_at, failed_count, cooldown_until, updated_at)
  values (p_bucket_hash, now_ts, 0, null, now_ts)
  on conflict (bucket_hash) do nothing;

  select * into rec
  from public.access_code_attempt_guard
  where bucket_hash = p_bucket_hash
  for update;

  if rec.cooldown_until is not null and rec.cooldown_until > now_ts then
    return jsonb_build_object('ok', false, 'limited', true);
  end if;

  if rec.cooldown_until is not null and rec.cooldown_until <= now_ts then
    rec.window_started_at := now_ts;
    rec.failed_count := 0;
    rec.cooldown_until := null;
  elsif rec.window_started_at < now_ts - make_interval(secs => p_window_seconds) then
    rec.window_started_at := now_ts;
    rec.failed_count := 0;
    rec.cooldown_until := null;
  end if;

  if event_name = 'check' then
    update public.access_code_attempt_guard
    set window_started_at = rec.window_started_at,
        failed_count = rec.failed_count,
        cooldown_until = rec.cooldown_until,
        updated_at = now_ts
    where bucket_hash = p_bucket_hash;
    return jsonb_build_object('ok', true, 'limited', false, 'failedCount', rec.failed_count);
  end if;

  if event_name = 'success' then
    update public.access_code_attempt_guard
    set failed_count = 0,
        cooldown_until = null,
        window_started_at = now_ts,
        updated_at = now_ts
    where bucket_hash = p_bucket_hash;
    return jsonb_build_object('ok', true, 'limited', false);
  end if;

  rec.failed_count := rec.failed_count + 1;
  if rec.failed_count >= p_max_failures then
    rec.cooldown_until := now_ts + make_interval(secs => p_cooldown_seconds);
  end if;

  update public.access_code_attempt_guard
  set failed_count = rec.failed_count,
      cooldown_until = rec.cooldown_until,
      window_started_at = rec.window_started_at,
      updated_at = now_ts
  where bucket_hash = p_bucket_hash;

  if rec.cooldown_until is not null and rec.cooldown_until > now_ts then
    return jsonb_build_object('ok', false, 'limited', true, 'failedCount', rec.failed_count);
  end if;

  return jsonb_build_object('ok', true, 'limited', false, 'failedCount', rec.failed_count);
end;
$$;

revoke all on function public.check_access_code_rate_limit(text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.check_access_code_rate_limit(text, text, int, int, int) to service_role;
