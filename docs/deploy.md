# Deploy (Vercel + Supabase)

## Vercel project settings

- Framework preset: Vite. Build command `npm run build`, output directory `dist`, install command `npm ci`. Node 22 (`engines.node` is `22.x`).
- `vercel.json` routes `/b/:slug` to the OG function (`api/og.ts`), sends every other non-file, non-`/api/` path to `/index.html` (SPA fallback), and caches `/assets/*` as immutable. Real files and `/api/*` are served before rewrites.
- Do not set any Supabase service-role key on Vercel. Only the agents use it, and they run elsewhere.

## Environment variables (names only)

| Name | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build | Supabase project URL for the SPA |
| `VITE_SUPABASE_ANON_KEY` | build | anon (publishable) key for the SPA |
| `SUPABASE_URL` | function | OG function; falls back to `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | function | OG function; falls back to `VITE_SUPABASE_ANON_KEY` |
| `VITE_CONTACT_EMAIL` | build | copyright/takedown address shown in the footer; the footer line is hidden when unset |

## Supabase Auth (production project)

- Site URL: the production origin (for example `https://<your-domain>`).
- Redirect URLs: the production origin plus `/**` (covers `/login`, `/reset`, `/boards`), and the Vercel preview pattern if previews should sign in. Keep `http://127.0.0.1:*` only in the local config, not in production.
- Google and GitHub: create OAuth apps whose callback is `https://<project-ref>.supabase.co/auth/v1/callback`; enter the client id and secret in the Supabase dashboard (never in the repo).
- REQUIRED: "Confirm email" stays ON in production. Board invites match the caller's auth email only when `email_confirmed_at` is set; turning confirmations off lets someone register an unconfirmed account with a victim's address and claim their invites.
- REQUIRED: only enable OAuth providers that return verified emails (Google and GitHub primary-verified emails). Do not add a provider that can return an unverified email.

## Auth email (custom SMTP)

Supabase's built-in mailer is for testing only: about 2 auth emails per hour per project ("email rate limit exceeded"), and it may deliver only to addresses on the Supabase team. Real users need custom SMTP.

Free option: Resend (3,000 emails per month, 100 per day). It sends to any recipient only from a domain you have verified, so use a subdomain of a domain you own (for example `mail.<your-domain>`), not a shared address.

1. Resend: Domains, Add Domain, enter the subdomain. Add the DNS records it lists (DKIM TXT, SPF TXT and MX for the send subdomain) at your DNS host, then Verify.
2. Resend: API Keys, create a key with "Sending access" limited to that domain. Treat it as a secret: never commit it, and enter it only in the Supabase dashboard.
3. Supabase dashboard, Authentication, Emails, SMTP Settings, enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password the API key, sender e.g. `noreply@<send-subdomain>`, sender name `Yarns`.
4. Authentication, Rate Limits: raise "Rate limit for sending emails" (it is only adjustable once custom SMTP is on). Keep it modest to limit abuse.
5. Test: sign up with a fresh address, confirm the email arrives (check spam once), and run the reset-password flow. Confirmations stay ON.

Re-signing up with an already confirmed address sends nothing by design (it does not reveal which addresses exist); test with a new address, or use reset-password.

## SPA fallback caveats (vercel.json)

- The catch-all rewrite sends every path without a dot (except `/api/...`) to `/index.html`. Paths containing a dot (for example `/foo.txt`) and `/.well-known/...` are not rewritten, so they 404 unless a real file exists. A bare `/api` (no trailing slash) is rewritten to the SPA shell; `/api/...` is not.
- `/b/<slug>` goes through the OG function, which fetches `/index.html` from its own deployment. With Vercel Deployment Protection enabled on preview URLs that self-fetch is blocked, so preview deployments may show a blank or minimal shell for `/b/...`. Production (unprotected) is the check that matters; or disable protection for previews you want to test.

## Demo board

See `agents/README.md` ("Demo board"). The seed writes a private draft; publishing is a separate explicit step. The fixture was written from memory: a human must open all three source URLs (Wikipedia, Britannica, Nature) before publishing; Britannica may return 403 to bots. The service-role publish cannot render the share-preview thumbnail (that needs a browser canvas), so pass a PNG with `--thumbnail`, or the demo has no `og:image`.

## Post-deploy checklist

1. `/` loads; open `/topics` and `/boards` directly (hard refresh) and confirm they load, not 404 (SPA fallback).
2. `/assets/*.js` returns JS with `Cache-Control: public, max-age=31536000, immutable`; a made-up `/assets/nope.js` is a 404, not HTML.
3. DevTools network tab: no requests to `fonts.googleapis.com` or `fonts.gstatic.com`; Permanent Marker loads from `/assets/*.woff2`.
4. `/b/<public slug>` view-source has the board title in `og:title` and, for a board with a published thumbnail (any board published from the app, or the demo published with `--thumbnail`), an `og:image` that loads (without one `/api/og?image=1` is a 404); a private or unknown slug shows generic meta with no title.
5. Register with email, confirm the email arrives and is required before login; reset password works; Google and GitHub sign-in work and land back on the app.
6. Footer shows the contact address (or nothing if `VITE_CONTACT_EMAIL` is unset).
7. Create and run the demo seed, open all three source URLs yourself (the fixture was written from memory and never fetched), review the draft, publish it with `--thumbnail <320x200 png>`, and open it logged out. It must be the Dyatlov Pass board and nothing else.
8. Confirm the Supabase dashboard shows "Confirm email" ON and no service-role key in Vercel env.
