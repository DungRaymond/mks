# Class Hub

Next.js App Router project scaffold for the Class Hub plan.

## Development

```bash
npm run dev
```

Open http://localhost:3000. Configure Supabase and Uploadcare in `.env.local`.

## Client data cache

- Home and item details share the same in-memory/localStorage cache and display it without waiting for Supabase.
- On navigation, every 60 seconds, and when focus/connectivity returns, fetch only `id, updated_at` metadata. Fetch full records only for new or changed IDs; remove deleted/unpublished IDs.
- Unchanged metadata leaves stored data and item references untouched: no localStorage write and no replacement of the displayed content. Successful mutations update this same cache.
- Image metadata is cached against the item's `updated_at`. Network failures retain existing content. This is a data cache, not an offline app-shell/service-worker cache.
- Session/permission checks run separately and never block public cached content; mutations still verify permissions on the server.

## Item URLs

Item URLs use a title excerpt (up to six meaningful words / 26 ASCII characters) plus an eight-character ID suffix. This is derived from the existing title/ID, so all existing items and locally cached data adopt the shorter URLs without a database migration or cache rewrite. UUID links continue to redirect; previous title slugs resolve through the ID suffix. Database IDs and mutation/image API identifiers remain UUIDs.

## Checks

With Node.js 22.18+ (or Node.js 24):

```bash
npm test
npm run lint
npm run build
```
