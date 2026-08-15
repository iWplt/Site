-- Secure pickup tokens for QR delivery. Do not edit 0001–0010.
-- Lookup uses pickup_token_hash. Ciphertext is only for reprinting the same QR.

alter table public.submissions
  add column if not exists pickup_token_hash text;

alter table public.submissions
  add column if not exists pickup_token_ciphertext text;

create unique index if not exists submissions_pickup_token_hash_uidx
  on public.submissions (pickup_token_hash)
  where pickup_token_hash is not null;
