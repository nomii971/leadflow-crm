# LeadFlow CRM

A personal, single-user CRM for collecting, importing, de-duplicating, organising and exporting large numbers of business leads from **authorized** sources.

Stack (all free tier): Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui-style components · Supabase (Postgres + Auth + Row Level Security) · Papa Parse · SheetJS · Recharts · Lucide · Vercel Hobby.

---

## What it does

| Area | Highlights |
|---|---|
| **Bulk Lead Collector** | Pick countries / multiple cities + job title, industry, company, size, seniority, department, keywords. A job fetches page after page until the source says there are no more results, your limit is hit, the source restricts access, you cancel, or an error stops it. Automatic retry with backoff, pause / resume from a saved cursor, cancel, live counts (reported total, retrieved, saved, duplicates, review, filtered, failed, remaining), honest final status (Complete / Partially complete / Limit reached / Interrupted / Failed), downloadable results and failed-record logs. |
| **Sources (adapters)** | *Authorized export file* (CSV/XLSX processed page by page with your filters) · *HubSpot CRM (free)* via official API, including Sales Navigator leads synced with LinkedIn's CRM Sync · *LinkedIn Sales Navigator* shown as "Not connected" with an explanation (no public API). New sources plug in through one interface. |
| **Bulk CSV / Excel import** | Upload → auto-detect & map columns → preview → validate every row → duplicate pre-check → choose strategy → batched import (500 rows/batch) with live progress → report. Invalid rows are never dropped silently: they are stored with the reason and downloadable as CSV. Re-running a batch is idempotent. |
| **Duplicate detection** | LinkedIn URL (normalised), business email, name + company (legal suffixes ignored). Strategies: skip, update existing, keep both, review. Uncertain (name + company) matches are **never merged automatically**: they go to the review queue with a side-by-side comparison. |
| **Leads** | Server-side search, filters, sorting, pagination; bulk select (page or *all matching*), bulk status / priority / add to list / export / delete; custom columns; full profiles with business / personal email, business / mobile phone and company email / phone (from your imports, HubSpot or manual entry; verified vs unverified), source + collection date, notes, activities, follow-ups. |
| **Lists, pipeline, follow-ups** | Custom lists with stats and export · drag-and-drop Kanban (New → Won/Lost) · calls, emails, LinkedIn messages, meetings, notes · tasks with due dates, priorities, overdue / upcoming views. |
| **Export Center** | All / filtered / by country / city / industry / job title / list / collection job, choose columns, CSV or XLSX. CSV cells are protected against formula injection. |
| **Dashboard** | Totals, new, imported, contacted, interested, qualified, converted, companies; charts for growth, country, city, industry, status, import history; recent jobs and imports. All from live database queries. |

### What it deliberately does not do

- No scraping of LinkedIn, no browser automation on LinkedIn, no reading of LinkedIn cookies, no undocumented/private LinkedIn APIs.
- It never claims "all leads collected" unless the source gives a completion signal.
- No fake progress and no sample leads shipped as real data.

**Sales Navigator, honestly:** Sales Navigator has no general bulk export and no public search API. Authorized ways to get those leads in: (1) Sales Navigator **CRM Sync** to HubSpot (needs a Sales Navigator plan that includes CRM Sync), then the HubSpot source here; (2) exports from a CRM or data provider you are licensed to use, via import or the file source; (3) lists you build yourself, keeping profile URLs as source references.

---

## Setup (about 15 minutes, all free)

### 1. Supabase
1. Create a free project at <https://supabase.com>.
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`, then `0002_contact_fields.sql` (run the files in order).
3. **Authentication → Users → Add user**: your email + a strong password (tick "Auto confirm").
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

### 2. Run locally
```bash
npm install
cp .env.example .env.local   # then fill in the values (never commit this file)
npm run dev                  # http://localhost:3000
```

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...      # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # anon public key (safe in the browser; RLS protects data)
ADMIN_EMAIL=you@example.com       # only this account can use the app
HUBSPOT_ACCESS_TOKEN=             # optional, server-only
```
No service-role key is needed: every query runs as the signed-in user under Row Level Security.

### 3. Deploy to Vercel (Hobby)
1. Push this folder to a private GitHub repository.
2. <https://vercel.com/new> → import the repo (framework auto-detected).
3. Add the same environment variables in **Settings → Environment Variables**, then deploy.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to your Vercel URL.

### 4. Optional: HubSpot source
HubSpot → Settings → Integrations → Private Apps → create an app with scope `crm.objects.contacts.read` → copy the token into `HUBSPOT_ACCESS_TOKEN` on Vercel → redeploy. The Integrations page shows the live status.

---

## Free tier limits to know

- **Supabase Free:** 500 MB database (roughly 150k–200k leads with logs), projects pause after 7 days without activity (resume in the dashboard), daily backups not included.
- **Vercel Hobby:** for personal, **non-commercial** use. If the CRM supports a business you earn from, Vercel's terms may require the Pro plan; alternatives are Netlify or Cloudflare free tiers, or self-hosting with `npm run build && npm start`. Function time is capped (60 s here), which is why imports and collection jobs run one batch / page per request.
- **HubSpot free API:** rate limits (search ≈ 5 req/s); the search API returns at most 10,000 results per query, so bigger result sets finish as *Partially complete*: split the job by city.
- **Long jobs:** collection and import are driven from the browser tab, page by page. Closing the tab pauses work; progress is saved and the job can be resumed. (A free always-on background worker isn't available on Vercel Hobby.)

---

## Security

- Supabase Auth with sign-ups disabled + `ADMIN_EMAIL` lock enforced in middleware, server actions and API routes.
- Row Level Security (forced) on every table: `user_id = auth.uid()`; the anon role has no table access.
- All inputs validated server-side with Zod; uploaded cells sanitised (control characters, length caps); CSV exports escape formula injection.
- Uploaded files are parsed in the browser and only sent as validated JSON batches; nothing executable is stored.
- Login and API rate limiting; security headers (no framing, nosniff, strict referrer).
- Secrets live only in environment variables; `HUBSPOT_ACCESS_TOKEN` is never sent to the browser.

---

## Development & tests

```bash
npm run typecheck
npm test          # unit tests: normalisation, validation, duplicates, collector engine, adapters
npm run test:db   # applies the migration to a throwaway local Postgres and tests RLS, triggers, RPCs
npm run build
```

### Adding a new authorized source
1. Create `src/lib/collector/adapters/<name>.ts` implementing `SourceAdapter` (`status()` + `fetchPage({ config, cursor, pageSize })` returning records, `nextCursor` (null = finished) and `totalReported`).
2. Throw `RetryableSourceError` for temporary errors, `SourceRestrictionError` when the source stops you, `SourceConfigError` for auth/config problems.
3. Register it in `src/lib/collector/registry.ts`. It now appears in Integrations and the Bulk Lead Collector with retries, pagination, duplicates, progress and reports.

### Project layout
```
supabase/migrations/0001_init.sql   schema, indexes, RLS, triggers, RPCs
src/app/(app)/...                   pages (dashboard, collector, leads, lists, pipeline, ...)
src/app/api/...                     import batches, collector steps/control, exports
src/lib/collector/                  engine, filters, adapters, registry
src/lib/leads/                      fields, normalisation, validation, dedupe, writer, queries
src/lib/csv/                        streaming reader, sanitisation
tests/                              unit tests + SQL tests
```

### Notes / assumptions
- SheetJS is installed from npm (`xlsx@0.18.5`), the last version published there. It is used to write exports and to read your own XLSX uploads. For the newest Community Edition, replace the dependency with `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`.
- HubSpot property names for LinkedIn URL / seniority vary by portal (`hs_linkedin_url`, `linkedin_url`, …); the adapter requests the common ones. Check your portal if a field arrives empty.
- Country names are normalised on save (UK → United Kingdom, UAE → United Arab Emirates, USA → United States).
