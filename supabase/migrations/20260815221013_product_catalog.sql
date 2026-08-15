-- Owner-managed product catalog.
-- HOLD: do not apply with `db push` until 0012 handling is approved.
-- This file sorts AFTER 20260814140012_performance_indexes.sql, so a normal
-- `npx supabase db push` would apply 0012 first. Move 0012 out of
-- supabase/migrations (same as the 0007 procedure) before applying this file.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories (id),
  name_ar text not null,
  name_en text,
  description text,
  price_iqd numeric(12, 2),
  image_path text,
  active boolean not null default true,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_ar_not_blank check (length(btrim(name_ar)) > 0),
  constraint products_price_non_negative check (price_iqd is null or price_iqd >= 0)
);

create table if not exists public.product_availability (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  scope text not null check (scope in ('all', 'individual', 'batches', 'forms')),
  batch_id uuid references public.batches (id) on delete cascade,
  form_id uuid references public.booking_forms (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_availability_scope_shape check (
    (scope = 'all' and batch_id is null and form_id is null)
    or (scope = 'individual' and batch_id is null and form_id is null)
    or (scope = 'batches' and batch_id is not null and form_id is null)
    or (scope = 'forms' and form_id is not null and batch_id is null)
  )
);

create unique index if not exists product_availability_all_uidx
  on public.product_availability (product_id)
  where scope = 'all';

create unique index if not exists product_availability_individual_uidx
  on public.product_availability (product_id)
  where scope = 'individual';

create unique index if not exists product_availability_batch_uidx
  on public.product_availability (product_id, batch_id)
  where scope = 'batches';

create unique index if not exists product_availability_form_uidx
  on public.product_availability (product_id, form_id)
  where scope = 'forms';

create index if not exists products_category_sort_idx
  on public.products (category_id, sort_order, name_ar);

create index if not exists products_active_idx
  on public.products (active, archived);

insert into public.product_categories (slug, name_ar, name_en, sort_order)
values
  ('robe', 'روب', 'Robe', 10),
  ('robe_additions', 'إضافات الروب', 'Robe additions', 20),
  ('sash', 'وشاح', 'Sash', 30),
  ('embroidery', 'تطريز', 'Embroidery', 40),
  ('cap', 'قبعة', 'Cap', 50),
  ('photography', 'باقة تصوير', 'Photography', 60),
  ('medal', 'ميدالية', 'Medal', 70),
  ('bouquet', 'بوكيه', 'Bouquet', 80),
  ('certificate_cover', 'كفر شهادة', 'Certificate cover', 90),
  ('shield', 'درع', 'Shield', 100),
  ('extras', 'إضافات أخرى', 'Other extras', 110)
on conflict (slug) do nothing;

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_availability enable row level security;

drop policy if exists "product categories owner manage" on public.product_categories;
drop policy if exists "product categories authenticated read" on public.product_categories;
drop policy if exists "products owner manage" on public.products;
drop policy if exists "products authenticated read" on public.products;
drop policy if exists "product availability owner manage" on public.product_availability;
drop policy if exists "product availability authenticated read" on public.product_availability;

create policy "product categories owner manage"
  on public.product_categories
  for all
  using (private.is_owner())
  with check (private.is_owner());

create policy "product categories authenticated read"
  on public.product_categories
  for select
  to authenticated
  using (true);

create policy "products owner manage"
  on public.products
  for all
  using (private.is_owner())
  with check (private.is_owner());

create policy "products authenticated read"
  on public.products
  for select
  to authenticated
  using (archived = false);

create policy "product availability owner manage"
  on public.product_availability
  for all
  using (private.is_owner())
  with check (private.is_owner());

create policy "product availability authenticated read"
  on public.product_availability
  for select
  to authenticated
  using (true);

grant select, insert, update, delete on public.product_categories to authenticated, service_role;
grant select, insert, update, delete on public.products to authenticated, service_role;
grant select, insert, update, delete on public.product_availability to authenticated, service_role;
