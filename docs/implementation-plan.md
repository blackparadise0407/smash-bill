# Smash Bill MVP Implementation Plan

## Tech stack

- Next.js App Router for frontend and backend route handlers.
- Neon Postgres as the serverless database.
- TailwindCSS for a brutalism UI style.
- `@fingerprintjs/fingerprintjs` for browser fingerprinting on the client.
- `jose` for signing and verifying JWT sessions.
- HttpOnly cookie for session persistence.

## MVP database tables

- `devices`: keep the identity/session table from the auth-less flow.
- `events`: stores available voting schedules with `id`, `name`, `choices text[]`, `description`, and billing `status`.
- `event_voters`: stores that a device voted for any valid event option by `event_id` and `voter_id`; the unique `(event_id, voter_id)` constraint prevents duplicate voter records for the same device.
- `billings`: stores each invoice category by `event_id`, `category`, and `total_amount`.
- `billing_details`: stores each member's allocated amount by `billing_id`, `username`, `hours`, and `amount`.
- `event_debts`: stores the final per-user debt by `event_id`, `username`, `total_debt`, and `status` (`UNPAID` or `PAID`).

## Identity flow

1. User opens the single public link.
2. Client collects `fingerprintVisitorId` and creates or reuses `deviceUuid` in localStorage.
3. Client posts both values to `/api/auth/handshake`.
4. Server hashes both identifiers with `IDENTITY_PEPPER` and checks Neon Postgres.
5. If the device exists, server signs a JWT and sets `sb_session` as an HttpOnly cookie.
6. If the device is new, client asks for username and repeats the handshake.
7. Event voting uses only the HttpOnly cookie; `/api/vote` validates the submitted option against `events.choices` and then adds the device to `event_voters`. Raw identity values are never needed by `/api/vote`.

## Billing flow

1. Admin opens `/event/[id]/billing` after the event ends.
2. The page loads voters from `event_voters` joined with `devices`.
3. Admin creates one or more draft categories. Each category can split by hours or split equally among checked members.
4. The React client keeps drafts in `savedBillings` and computes `finalSummary` with `useMemo` before anything is persisted.
5. Admin clicks **Chốt & Xuất hóa đơn**. The client sends the draft array to `POST /api/event/[id]/invoice`.
6. The API stores `billings`, `billing_details`, aggregates `event_debts`, and updates the event status to `COLLECTING` in one SQL CTE statement.

## Neon setup

1. Create a Neon project.
2. Copy the pooled connection string into `DATABASE_URL`.
3. Run `db/001_identity_and_events.sql` in the Neon SQL editor. This migration drops the old `votes` table if it exists, then creates identity, event, voting, billing, billing detail, and debt tables.
4. Add `DATABASE_URL`, `JWT_SECRET`, `IDENTITY_PEPPER`, and `SESSION_COOKIE_NAME` in Vercel environment variables.

## Security notes

- Raw fingerprint and raw device UUID are never stored in the database.
- JWT is stored in an HttpOnly cookie instead of localStorage.
- Event voter duplication is blocked by the unique `(event_id, voter_id)` database constraint after any valid option vote.
- This is intentionally not full authentication; users can still bypass with another real device or hardened privacy browser.
