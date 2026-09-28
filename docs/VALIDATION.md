# Validation — 2026-09-28

- npm install: completed; dependency audit reported 0 vulnerabilities. Versions and lockfile committed. npm 12 reported blocked optional dependency install scripts; installed platform packages were sufficient for all checks.
- npm run lint: passed, no ESLint warnings or errors.
- npm run typecheck: passed; regenerates Next.js route types before strict TypeScript checking.
- npm test: 7 tests passed (core domain, PostgreSQL/RLS integration, DOM interactions).
- npm run import:data: 372 projects, 810 companies, 2,386 company reuse encounters, 1,755 participant relationships, 331 coordinate pairs, 7 warnings.
- npm run build: passed with Next.js 16.3.6 / React 19.3.0 / TypeScript 6.0.3. Dynamic App Router pages and API handlers generated.
- Original data/projects.json, data/participants.json and data/meta.json: no Git changes.
- Client static assets scanned for privileged environment-variable names; none found. Server-only AI/registry modules enforce the client boundary; import CLI alone consumes service_role.
- Production server HTTP smoke: `/`, `/projects/city-001`, `/companies`, `/specifications` returned 200 in explicit read-only mode; unauthorized company mutation was rejected.
- DOM test: real-data search reduced 372 records to the expected ETÉRA result; cards and project tabs worked; read-only controls were disabled; company/contact/participant payloads and multi-section selection/upload metadata were checked with mocked HTTP responses.
- PGlite integration: real migrations/import, idempotent reruns preserving CRM edits, contact/participant/section creation, specification-item persistence, calculation transaction, immutable actor audit, profile escalation denial, viewer read-only access, Storage policy isolation and service-role-only import permission.

## Checks still requiring the target environment

No Supabase, OpenAI, Google Maps or registry credentials were supplied. Hosted Auth/Storage behavior, actual PDF/DOCX/XLS(X) AI extraction quality, Maps rendering and the existing Netlify site deployment remain unverified. The database test uses PostgreSQL with simulated Supabase auth/storage schemas; the UI test mocks HTTP. They are not substitutes for live-service end-to-end testing.

Native browser automation failed before opening a page because of a macOS sandbox initialization error (`TIOCSTI`); a headless Chrome fallback also failed to launch. Visual desktop/mobile QA therefore remains a manual staging check. No screenshot or successful real-browser run is claimed.

The local sandbox initially prevented Turbopack from opening its internal port. After granting network permission and clearing only generated .next cache, the final build passed. A low file-descriptor limit also affected next dev in this environment; on affected macOS shells raise the soft limit (`ulimit -n 4096`) or use Watchpack polling before starting development.

## Foundation scope

This is a functional shared-workspace CRM foundation. Current deliberate limits: read-only mode without Supabase; one-line financial calculation editor; 4 MiB upload limit; synchronous AI parsing (manual recovery of a hard-killed processing record); latest 200 events shown in UI; browser-side search over a paginated server-loaded dataset; no automatic fuzzy company merges or assertions of technical equivalence. A durable worker and server-side filtered pagination are the next production-scale improvements.
