# Forma — Gym Management

An owner-only, multi-tenant gym management SaaS app. Each owner account manages one gym. Members are entered by gym owners and do not have login accounts.

## What is implemented

- Owner registration/login with bcrypt password hashing and opaque, revocable, HTTP-only sessions.
- Owner setup and gym profile management, strict gym-scoped API access, and soft archival of members.
- Member, plan, membership, and payment APIs; plan price/duration snapshots; inclusive expiry dates; INR amounts stored in paise.
- Database-backed dashboard metrics, payment history, and two-day renewal reminder records.
- Razorpay Payment Links per gym merchant account; raw-body webhook signature verification, webhook idempotency, and renewal activation after verified payment.
- WhatsApp Cloud API template sender and a separate worker scheduled in Asia/Kolkata.
- AES-256-GCM encryption for gateway credentials, integration settings, responsive UI, theme persistence, and local dev seed data.

## Technology

React, Vite, TypeScript, Express, PostgreSQL, Prisma, bcryptjs, Luxon, node-cron, Lucide React.

## Local setup

Requirements: Node.js 20.19+ (or 22.12+) and PostgreSQL 14+.

1. Create a local PostgreSQL database named `forma`.
2. Copy `.env.example` to `.env` and set the database URLs and a random 32-byte base64 encryption key. Keep `.env` private.
3. Install dependencies and initialize the database:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   ```

4. (Optional) Configure `DEMO_OWNER_EMAIL` and `DEMO_OWNER_PASSWORD`, then run `npm run db:seed`. The seed command refuses to run with `NODE_ENV=production`; it creates one clearly documented development gym, plan, member, and offline cash payment.
5. Start the Vite frontend, Express API, and reminder worker:

   ```bash
   npm run dev
   ```

Vite is served at `http://localhost:5173`; its `/api` proxy forwards requests to the API at `http://localhost:4000`. The API health endpoint is `/api/health`.

## Database and Neon

`DATABASE_URL` is the app connection URL; `DATABASE_URL_UNPOOLED` is used by Prisma migrations. For Neon, use the pooled URL for `DATABASE_URL` and the direct URL for `DATABASE_URL_UNPOOLED`. This workspace is not connected to a Neon project. Set both values locally before running migrations.

```bash
npm run db:generate
npm run db:migrate       # local development migration
npm run db:deploy        # deploy committed migrations
```

Migrations are in `prisma/migrations/`; the data model enforces gym-scoped composite foreign keys for memberships, payments, and notifications.

## Tests and build

```bash
npm test
npm run build
```

Domain tests cover inclusive expiry, Asia/Kolkata reminder timing, E.164 normalization, and paise conversion. The tenant-isolation integration test runs only when `TEST_DATABASE_URL` is set to a disposable PostgreSQL database whose name contains `test`; it verifies a gym owner cannot list or change another gym's members, plans, or payments.

## Razorpay

Each gym owner enters their own Razorpay Key ID, Key Secret, and webhook secret under Gym Profile. Credentials are encrypted at rest with `CREDENTIALS_ENCRYPTION_KEY` and never returned by the API. Configure Razorpay's webhook endpoint as `/api/webhooks/razorpay` and enable the `payment_link.paid` event. The webhook handler verifies the raw request body with the gym's secret and deduplicates `x-razorpay-event-id` before recording payment and creating a renewal.

Use Razorpay test credentials during development. Payment links are not generated until that gym has configured a merchant account. A frontend redirect never marks a payment as paid.

## WhatsApp Business Cloud API

Under Gym Profile, each gym owner configures its Meta access token, Phone Number ID, approved template name, and language. The template is expected to have four body parameters, in order: member name, gym name, expiry date, and payment URL. Template content and approval are managed in Meta Business Manager. `WHATSAPP_GRAPH_API_VERSION` selects the Graph API version. No messages are sent when configuration is absent.

The standalone worker checks every minute. It atomically claims due notification records, makes one idempotent renewal payment request per membership, saves the generated payment URL, then sends the approved business-initiated template. Failed jobs receive bounded retries; stale `PROCESSING` jobs are recovered after a worker restart.

## Deployment notes

- Deploy the Vite frontend and Express API as separate services or behind one reverse proxy; set `WEB_ORIGIN` to the frontend origin and enable HTTPS so production cookies are secure.
- Run `npm run db:deploy` as a deployment migration step.
- Run `npm run db:deploy` only against the intended database; migration URLs should be direct/unpooled on Neon.
- Run `npm run dev:worker` as a separate always-on worker process in production (or use a reliable scheduled job that invokes the worker).
- The included Render Blueprint is a free preview: it deploys the web app and a free Postgres database, but omits the background worker. Free Render Postgres expires after 30 days, so use a paid database and deploy the worker before relying on persistent data or automatic renewal reminders.
- Configure `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CREDENTIALS_ENCRYPTION_KEY`, `WEB_ORIGIN`, `WHATSAPP_GRAPH_API_VERSION`, and provider credentials through the hosting platform's secret manager.
- Never commit `.env`, live provider credentials, or production data.
