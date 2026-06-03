# Smash Bill

Internal badminton voting and bill splitting MVP built with Next.js App Router, Neon Postgres, TailwindCSS brutalism UI, browser fingerprint identity, and HttpOnly JWT sessions.

## Current MVP data model

The MVP currently uses these tables:

- `devices`: hashed browser/device identity plus username/session version.
- `events`: `id`, `name`, `choices text[]`, `description`, `status`.
- `event_voters`: `id`, `event_id`, `voter_id` with a unique pair to prevent the same device from being recorded more than once per event after voting for any option.
- `billings`: invoice categories for an event.
- `billing_details`: per-user amount/hour allocation per category.
- `event_debts`: final debt summary per event and username.

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Create a Neon Postgres database and run:

   ```sql
   -- db/001_identity_and_events.sql
   ```

4. Start development server:

   ```bash
   pnpm dev
   ```

5. Create a sample event:

   ```bash
   curl -X POST http://localhost:3000/api/events \
     -H 'Content-Type: application/json' \
     -d '{"name":"Cầu lông thứ 3 · 19:00-21:00","choices":["Có đi","Không đi"],"description":"Sân ABC · 2 giờ"}'
   ```

6. Vote for any option. The selected option is validated against `events.choices`; if valid, the device is added to `event_voters` as the MVP attendance/voter record.

## Billing workflow

1. Users vote for any valid event option so they are stored in `event_voters`.
2. Admin opens `/event/<event-id>/billing`.
3. Admin adds draft categories such as `Sân cầu lông`, `Ăn uống`, or `Tiền nước`.
4. The UI recalculates per-user amounts in real time using checked members and either hours-based or equal split mode.
5. Admin clicks **Chốt & Xuất hóa đơn** to persist `billings`, `billing_details`, aggregate `event_debts`, and move the event to `COLLECTING`.

## Environment variables

- `DATABASE_URL`: Neon pooled Postgres connection string.
- `JWT_SECRET`: secret used by `jose` to sign session JWTs.
- `IDENTITY_PEPPER`: secret pepper used before hashing browser/device identifiers.
- `SESSION_COOKIE_NAME`: defaults to `sb_session`.

Generate secrets with:

```bash
openssl rand -base64 48
```
