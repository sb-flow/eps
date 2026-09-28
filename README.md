# Construction Radar UZ / EPS Construction CRM v2

Working Next.js foundation for a shared construction CRM, evolved in `feature/crm-v2` from the existing MVP. Original JSON files, IDs, coordinates, source links and static MVP reference files are preserved. No synthetic construction projects or product prices have been added.

## Local development

Node.js 24 LTS recommended (minimum 22.12).

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, development uses the real legacy dataset in **read-only mode**. Mutation controls are disabled; no browser database substitutes for PostgreSQL. On a production build without Supabase the default is a setup screen, not public data. Explicit `DEMO_MODE=true` enables a public read-only preview.

Dependencies are pinned in package.json and package-lock.json. SheetJS is obtained from its official distribution (the old npm xlsx release is not used). `.npmrc` allows direct remote dependencies for npm 12. The application does not need privileged keys to build.

## Environment

Copy `.env.example` to `.env.local` and fill only the required values. Environment files are ignored by Git.

| Variable | Use |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public API key, with RLS enabled |
| SUPABASE_SERVICE_ROLE_KEY | Import CLI only; never used by browser or normal application routes |
| OPENAI_API_KEY | Server-only specification extraction |
| OPENAI_MODEL | Structured Outputs model; default `gpt-4.1-mini`, change to one available to your account |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | Browser Maps API key restricted by HTTP referrer and API |
| DEMO_MODE | Explicit read-only production preview; leave false in production |
| COMPANY_REGISTRY_URL | Optional HTTPS registry adapter endpoint |
| COMPANY_REGISTRY_TOKEN | Server-only registry credential |

Only NEXT_PUBLIC variables are intended for the browser. Do not prefix privileged keys with NEXT_PUBLIC. Set production secrets in the existing Netlify site's environment settings, not source files. The service role key is only needed while running the import command locally.

## Supabase setup

1. Use the intended Supabase project. Apply the SQL migrations below in order.
2. Disable public signups in Supabase Auth and create users through the Supabase Auth dashboard. Password sign-in is available at `/login`. Public registration is not provided by this UI.
3. New users receive a `viewer` profile. Grant the first administrator through the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

For users already present before applying the migration:

```sql
insert into public.profiles(id, display_name)
select id, email from auth.users on conflict (id) do nothing;
```

4. Admin may manage all business records and roles; manager may edit business records; viewer can only read. The audit log is append-only for all application roles. Role elevation is protected by RLS.
5. Configure Auth Site URL for the existing deployment. This foundation uses one shared workspace, not tenant isolation. All approved profiles can read this workspace's data.

Cookie-based [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) refreshes sessions through proxy.ts. Every write verifies the authenticated user and manager/admin role; RLS also applies to direct API access.

## Database migrations

Apply in Supabase SQL Editor, in order, or through your configured Supabase CLI deployment:

1. `supabase/migrations/001_crm.sql`
2. `supabase/migrations/002_transactions.sql`
3. `supabase/migrations/003_integrity.sql`

17 tables: projects, companies, people, project_participants, project_participant_sections, project_sections, specifications, specification_items, products, product_matches, calculations, calculation_items, opportunities, activities, sources, history, profiles.

The migrations include constraints, stable IDs, trigram indexing, RLS, audit/update triggers, atomic participant and financial writes, a service-role-only import transaction, and a private `specifications` Storage bucket. No migration has been applied to a remote database automatically.

## Import existing data

```bash
npm run import:data
# Review work/import-report.json, then set the two import variables in your shell:
# NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm run import:data -- --apply
```

The CLI reads shell environment variables; it does not automatically load `.env.local`. With Node 24 you can also explicitly load the local env file:

```bash
node --env-file=.env.local --import tsx scripts/import-data.ts --apply
```

The source files are never changed. Stable UUIDs and conflict-ignore make reruns safe for existing CRM edits. The entire import commits or rolls back together. Inspect `docs/DATA-MIGRATION.md` for field mappings and seven ambiguous-name warnings.

Prepared records: **372 projects, 810 companies, 1,755 participant links, 331 coordinate pairs**. All 796 original participant records are preserved verbatim in sources.raw, including original source statements and object IDs. Local browser IndexedDB attachments from the MVP must be downloaded and uploaded separately.

## Pages and workflows

- `/`: global search, fuzzy company/INN search, role/region/category/stage/priority/contact/coordinate filters; table, cards and map share the same filtered records. Dashboard figures come from records, and currencies are not combined.
- `/projects/[id]`: overview/editing, participants, sections, specifications, opportunities, contacts, activities and history.
- `/companies`, `/companies/[id]`: shared company records, duplicate suggestions, linked projects/roles/sections, contacts and activities.
- `/specifications`: upload and review all project-linked specifications.
- `/products`: real product catalog entry.
- `/login`: password sign-in and sign-out.

Contacts can be reused through a company across multiple projects. Add a participant by choosing an existing company and contact, role and multiple sections. New company creation shows possible duplicates and requires acknowledging a separate identity when suggestions exist. An identical INN is rejected by the database.

History stores old/new row values, actor and time. The UI currently shows the latest 200 workspace events; the complete immutable log remains in PostgreSQL. The current dataset is read in paginated batches and indexed for client-side filtering. Larger deployments should move search and page-specific reads into server queries rather than increasing the browser snapshot indefinitely.

## Specifications and OpenAI setup

Upload XLSX, XLS, CSV, PDF or DOCX **up to 4 MiB**. The lower application limit leaves room for serverless request encoding. Originals are stored in private Storage; downloads use short-lived signed links. Only an authenticated editor can upload or start parsing.

Click **AI-разбор** after upload. This explicitly sends the document to OpenAI. Sheets are extracted with SheetJS, DOCX with Mammoth, PDFs through the API file input. Calls use [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), Zod validation, a 55-second API timeout, no automatic paid retries, and no document content in application logs. Model responses are not treated as authoritative technical or legal facts. Refusal, malformed output, timeout and oversized extraction leave the original file available and mark parsing as failed.

Extraction is synchronous in this foundation. The deployed function timeout must exceed the request and persistence time; for larger documents use a durable background worker. A hard process kill can leave `processing`; an admin can reset the status to `failed` before retrying. This should be replaced with leased jobs before high-volume production ingestion.

Product matching is deliberately conservative and deterministic: exact manufacturer/article or name similarity proposes candidates, contradictory DN/PN/Kvs excludes them, and all candidates require manual technical confirmation. Low extraction confidence is marked manual_review. Empty catalog produces unmatched results. No unverified technical equivalence is asserted.

Financial arithmetic uses Decimal.js in TypeScript, not AI. Each specification row can open a linked calculation; the current editor saves one line per calculation. Enter a separate calculation with explicit quantity, prices, currency, batch delivery/duty/certification/additional costs, VAT and markup. Explicit sales price takes precedence over markup. Margin is before VAT. Missing quantity or purchase price yields null total; zero is a valid known value. Opportunities keep confirmed/estimated/unknown separate. No previous quote parameters are inherited.

## INN registry

`CompanyRegistryProvider.lookupByInn()` returns authoritative fields, provider name, source URL, checked date and raw response. `HttpRegistryProvider` uses the configured authenticated HTTPS endpoint and validates its JSON contract. `DevRegistryProvider` returns no result, never invented legal details. `lib/ai/company-normalizer.ts` uses deterministic name normalization and preserves registry fields; OpenAI is not a legal registry.

The endpoint contract is `{inn,name,legal_name,legal_address,oked,registration_number,source_url}`; all fields except inn/name/source_url may be null. A real Uzbekistan registry integration requires its provider contract and credentials.

## Google Maps setup

Enable Maps JavaScript API and billing in the intended Google Cloud project. Restrict the browser key to that API and your application domains. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and rebuild. Existing coordinates are retained without geocoding. Markers are clustered; clicking one opens the permanent project URL. Without a key the UI reports the number of available coordinate pairs.

## Netlify deployment

Use the **existing Netlify site**. No site creation or deployment is performed by this change. `netlify.toml` overrides the previous static build settings with `npm run build`, publish `.next`, Node 24. The [Netlify Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) is detected automatically. Do not publish the repository root or use static export: Auth and server APIs require the Next.js runtime.

Set the branch deployment to feature/crm-v2 for a reviewed preview. Configure public build variables and server runtime secrets in that site. Verify your function duration supports AI parsing and use a background worker for workloads above the synchronous limit. Do not change the main production branch or create another site automatically.

## Checks

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run import:data
npm run build
```

Tests include DOM interaction checks for search, views, project tabs, company/contact/participant forms and upload requests (with mocked HTTP), plus real-data preservation, company normalization, deterministic finance, conservative matching, and real PostgreSQL SQL migrations through PGlite with simulated Supabase auth/storage schemas. This validates SQL and RLS, but does not replace end-to-end verification against hosted Supabase Auth/Storage or a live OpenAI/Google account.

## Production checklist

- Review the seven import warnings and validate company identities; keep the original dataset backup.
- Apply migrations to staging and import using the service role CLI; issue admin/manager/viewer accounts.
- Verify login, role restrictions, participant/contact forms, private upload/download, AI parse/retry, and technical match review with actual credentials.
- Inspect mobile/desktop UI in a working browser and validate Google Maps on the deployment domain.
- Verify costs, tax assumptions and confirmed/estimated labels against a known calculation.
- Verify Netlify adapter/runtime limits, environment variables, demo mode off, and no repository-root publication.
- Add durable parsing jobs and server-side paginated searches before increasing workload materially.
- Review branch diff and checks before merging. No merge or force push is performed.
