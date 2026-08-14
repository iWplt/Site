# WARKA Booking Management System

Production-oriented full-stack system for managing graduation clothing bookings, university batches, student access codes, dynamic Arabic RTL forms, Owner-managed product option images, student design uploads, orders, and audit history.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS v4
- Supabase PostgreSQL, Auth, Storage, RLS
- Zod validation
- `@e965/xlsx` for XLS/XLSX preview

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables, the app runs in an **explicit local demo fallback** (`.data/warka-db.json`) for UI review only. This is NOT production.

With Supabase configured, all privileged reads/mutations go through Supabase Auth, PostgreSQL (+ RLS), Storage, and booking RPCs.

### Production hard rules

- If the runtime is production (`NODE_ENV=production` outside Next build phases, or `VERCEL_ENV=production`, or `WARKA_RUNTIME_ENV=production`), Supabase is **mandatory**.
- Local/demo persistence is **impossible** in production — even if `WARKA_ALLOW_LOCAL_DEMO=true`.
- Missing Supabase config fails loudly with a clear configuration error. The app never silently falls back to `.data/warka-db.json`.

## Supabase setup (Owner bootstrap)

1. Create a Supabase project.
2. Apply migrations in order:
   - `supabase/migrations/0001_warka_booking_schema.sql`
   - `supabase/migrations/0002_submission_files_and_reps.sql`
   - `supabase/migrations/0003_submit_transaction_files.sql`
   - `supabase/migrations/0004_option_images_and_storage_policies.sql`
3. Create the first Owner in **Authentication → Users** (email + password). There is **no public staff signup**.
4. Insert the Owner profile (replace UUIDs/email):

```sql
insert into public.profiles (id, full_name, role, email, disabled)
values (
  '<auth-user-uuid>',
  'مالك WARKA',
  'OWNER',
  'owner@example.com',
  false
);
```

5. Set server/environment variables from `.env.example` (Vercel or host). Generate secrets with `openssl rand -hex 32` for:
   - `ACCESS_CODE_ENCRYPTION_KEY`
   - `ACCESS_CODE_HMAC_SECRET`
   - `BOOKING_SESSION_SECRET`
6. Confirm Storage buckets exist: `booking-uploads` (student designs) and `form-options` (Owner product reference images). Both must remain **private**.

### Representative bootstrap (Owner UI)

Owner → Representatives → create/invite → set name, phone, login email, password → assign one or more batches → activate. Representatives authenticate via Supabase Auth and are limited by RLS + server checks to assigned batches only.

## Two image systems

1. **Option / product reference images** — uploaded by Owner in Form Builder per option (`form-options` Storage). Shown on student product cards.
2. **Student design attachments** — uploaded by students during booking (`booking-uploads` Storage), stored as `submission_files` rows. May be single or multiple per field.

Do not mix these.

## Important URLs

- Admin dashboard: `/admin`
- Forms / option images: `/admin/forms`
- Public sample form (local demo): `/f/cybersecurity-2027`
- Booking wizard after access verification: `/f/[slug]/book`

## Quality

```bash
npm run lint
npm run typecheck
npm run build
```
