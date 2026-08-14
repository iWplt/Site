# WARKA Booking Management System

Production-oriented full-stack system for managing graduation clothing bookings, university batches, student access codes, dynamic Arabic RTL forms, uploads, orders, and audit history.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS v4
- Supabase PostgreSQL, Auth, Storage, RLS
- Zod validation
- React Hook Form ready form architecture
- `@e965/xlsx` for XLS/XLSX preview without known npm audit advisories

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables, the app runs in an **explicit local demo fallback** (`.data/warka-db.json`) so UI and workflows can be reviewed. This is NOT production.

With Supabase configured, privileged reads and mutations must go through Supabase Auth, RLS policies, service-role route handlers, signed storage uploads, and database RPCs.

On Vercel production (`VERCEL_ENV=production`), missing Supabase config fails loudly unless `WARKA_ALLOW_LOCAL_DEMO=true` is set intentionally.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_warka_booking_schema.sql`.
3. Create the first owner user in Supabase Auth.
4. Insert the corresponding row into `public.profiles` with role `OWNER`.
5. Set the Vercel environment variables from `.env.example`.

Generate secret values with:

```bash
openssl rand -hex 32
```

Use separate values for `ACCESS_CODE_ENCRYPTION_KEY`, `ACCESS_CODE_HMAC_SECRET`, and `BOOKING_SESSION_SECRET`.

## Deployment

- Deploy the Next.js app to Vercel.
- Configure Supabase URL and anon key as public variables.
- Configure service-role and encryption/session secrets as server-only variables.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, encryption keys, or HMAC secrets to browser code.

## Important URLs

- Admin dashboard: `/admin`
- Public WARKA sample form: `/f/cybersecurity-2027`
- Public booking wizard after access verification: `/f/[slug]/book`
