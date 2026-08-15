# WARKA production deployment checklist

Do not rotate `ACCESS_CODE_ENCRYPTION_KEY`, `ACCESS_CODE_HMAC_SECRET`, or `BOOKING_SESSION_SECRET`. Existing codes, sessions, receipts, and pickup tokens depend on them.

## Host: Netlify Free + existing Supabase (`iyspwyljihtduvnibzll`)

Build command: `npm run build`  
Publish directory: `.next`  
Node: 22  

Do not set `output: "export"`. Do not pin `@netlify/plugin-nextjs` unless Netlify support asks you to; the OpenNext runtime is applied automatically.

## Required environment (Netlify Site settings → Environment variables)

Copy current production values from `.env.local`. Never paste them into chat, git, or build logs.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `ACCESS_CODE_ENCRYPTION_KEY` (server-only, keep current value)
- `ACCESS_CODE_HMAC_SECRET` (server-only, keep current value)
- `BOOKING_SESSION_SECRET` (server-only, keep current value)
- `NEXT_PUBLIC_APP_URL` (canonical HTTPS origin, no trailing slash)
- `RECEIPT_TTL_DAYS` (optional, default 30)

Scopes: Production (and Preview only if you intentionally want preview to hit the same Supabase project).

Until `NEXT_PUBLIC_APP_URL` is set, server URL generation may use Netlify's HTTPS `URL` variable. After the first deploy, set `NEXT_PUBLIC_APP_URL` to `https://<site>.netlify.app` (or the custom domain) and redeploy.

## Do not

- Run `supabase db push` or `supabase db reset`
- Rotate crypto secrets
- Expose the service role as `NEXT_PUBLIC_*`
- Enable `WARKA_ALLOW_LOCAL_DEMO` on Netlify

## Free-tier monitoring

Netlify (Site → Usage): bandwidth, build minutes, function invocations.  
Supabase (Project → Settings → Usage / Reports): database size, storage, egress, API requests.

Suggested storage warning: below 70% OK · 70–85% watch · above 85% plan cleanup. Do not delete customer files automatically.

## Migration history (before the next schema change only)

Live SQL already includes pickup tokens and hardening. CLI history still uses timestamp versions. Do not `db push` until:

```
npx supabase login
npx supabase link --project-ref iyspwyljihtduvnibzll
npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010 0011
```
