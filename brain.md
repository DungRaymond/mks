# Class Hub — Project Brain

Last updated: 2026-10-30

## Product

- Public class hub for tasks, homework, and important notices.
- Roles: public (read published items), officer (manage class content), admin (officer rights plus officer management).
- UI palette: warm beige / natural linen / light oak / dusty rose. Reserve red/dusty rose emphasis for urgent special notices.
- Subject cards use per-subject colors. Current known subject: `Lý - dược`.
- No separate tags. `type` differentiates `task`, `homework`, and `notice`; `subject` is the course.
- Tasks and homework default to due date seven days after creation unless creator chooses another date.

## Stack and environment

- Next.js 16.2.9 App Router, TypeScript, React 19, Tailwind 4.
- Supabase Postgres/RLS; do not use Supabase Auth. Staff login uses username/password.
- Passwords use Argon2id hashes. Session cookie is opaque random token; DB stores SHA-256 token hash.
- Session expires after 10 days; authenticated requests extend DB expiry. Proxy refreshes cookie max-age.
- Uploadcare React uploader dependency installed; uploader UI not implemented yet.
- Environment variables are in ignored `.env.local`; never copy values into docs, client code, or commits:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `UPLOADCARE_SECRET_KEY` (server-only)

## Current routes and behavior

- `/`: public homepage. Shows published upcoming tasks/homework prioritized by priority then due date, followed by recently updated items. Logged-in staff see quick-create form.
- `/items/[id]`: public item detail and Open Graph/Twitter metadata for share previews. Uses existing schema; no migration needed for this route.
- `/login`: username/password login.
- `/admin`: authenticated dashboard listing up to 100 most recently updated items. Full row links to item detail. Has create and logout controls.
- `/admin/new`: authenticated full create form, currently supports `task` and `homework`; no image uploader yet.
- Homepage quick-create supports `task` and `homework`, title, subject, due date, description; no images by design.
- `/admin/officers`, edit/delete, notice creation, history UI, and restore UI are not implemented.
- Logo and favicon: `public/k20-duoc.svg`, branded “K20 DƯỢC”.

## Supabase state

Existing tables: `profiles`, `class_items`, `item_images`, `class_item_history`, `auth_sessions`.

Migrations present in repository:

- `supabase/migrations/202610300001_class_hub_rpcs.sql`
- `supabase/migrations/202610300003_username_auth.sql`
- `supabase/migrations/202610300004_default_due_date.sql`

User reported running migrations. `save_class_item(payload, p_actor_id)` was tested successfully and creates an audit row. The first task is for `Lý - dược`; ID was `7a6509c4-5299-4dd4-8e33-96e650d2c563` at creation time. Do not rely on static data for application logic.

The SQL in migration 003 derives RPC definitions from existing functions. Verify deployed RPC signatures against app call sites when changing migrations. Service role key bypasses RLS, so every Server Action must call `getSession()` and authorize role itself before mutation. Never expose service key to browser.

Default due date trigger is `set_default_class_item_due_at` for `task`/`homework`; explicit `due_at` is preserved.

## Recent commits

- `d4064d5` Prepare Class Hub foundation and public task pages
- `00ac3f6` Add admin task dashboard and sliding sessions

## Validation

Run `npm run lint` and `npm run build` after code changes. For Next.js API/convention changes, read relevant guide under `node_modules/next/dist/docs/` first (see repository `AGENTS.md`).
