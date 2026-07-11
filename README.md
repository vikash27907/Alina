# FunWithU — funwithu.in

Live 1-on-1 video chat platform. Dark, exotic, simple, smooth.

Customers buy coins and get paired instantly with verified models on live
video. Models apply with ID verification, earn per minute + gifts, and
withdraw earnings. Admins review applications and process payouts.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS) — UI + API
- **Custom Node server** (`server.js`) — Socket.IO on the same port for
  matching, WebRTC signaling, in-call chat/gifts, and per-tick coin billing
- **Prisma + SQLite** (dev) — switch `DATABASE_URL` to PostgreSQL for production
- **WebRTC** — peer-to-peer video (Google STUN in dev; add a TURN server for production)

## Run locally

Requires a PostgreSQL database — a free [Neon](https://neon.tech) project works
for development too.

```bash
cp .env.example .env       # paste your Postgres URL + secrets
npm install
npm run setup              # creates tables + seeds the admin account
npm run dev                # http://localhost:3000
```

Production: `npm run build && npm start`

## Deploy free (Render + Neon + UptimeRobot)

1. **Supabase** (database): create a free project → Connect → choose
   **Session pooler** (NOT "Direct connection" — direct is IPv6-only and
   unreachable from Render) → copy the URI and replace `[YOUR-PASSWORD]`.
   If the password has special characters, percent-encode them
   (e.g. `@` → `%40`). Neon (neon.tech) works the same way if preferred.
2. **Render** (app): dashboard → *New → Blueprint* → connect this repo
   (`render.yaml` is auto-detected) → set `DATABASE_URL` and a strong
   `ADMIN_PASSWORD` when prompted → deploy. The build pushes the schema,
   seeds the admin and builds the app.
3. **UptimeRobot** (keep-awake): free monitor → HTTP(s) →
   `https://….onrender.com/api/health` → 5-minute interval. This stops the
   free Render instance from sleeping AND generates database activity so
   Supabase's free tier never pauses the project.
4. **Custom domain**: Render service → Settings → Custom Domains → add
   `funwithu.in` → create the CNAME/A records it shows at your DNS provider.
   TLS certificate is issued automatically.

Free-tier limits to know: the instance restarts on each deploy, so files in
`uploads/` (model verification photos) are wiped — fine for testing, but move
uploads to S3/Cloudinary (or a Render paid disk) before real onboarding.
Video calls are peer-to-peer, so call quality does not depend on the free
server size.

## The three sides

| Side | Entry | What they get |
|---|---|---|
| Customer | `/signup` → `/chat` | 30 trial coins, tap-to-match live video, chat, gifts, `/coins` store |
| Model | `/model/apply` → `/model/dashboard` | ID + selfie verification, go-online toggle, per-minute earnings (₹3/min + 60% of gifts), payout requests |
| Admin | `/admin` (seeded account) | application review with document viewer, payout queue, stats |

## Economy (edit `lib/economy.ts`)

- Video chat: **6 coins/minute** (billed in 10-second ticks, hard stop at 0)
- Trial: **30 coins** free on signup
- Packs: 300/₹499 · 900/₹1199 · 2000/₹1999
- Model rate: **₹3/minute** + **60%** of gift value; payouts from **₹500**

## Before real launch (deliberately stubbed)

1. **Payments** — `/api/coins/purchase` credits instantly (demo). Wire a
   high-risk processor (Segpay / CCBill / Epoch); credit coins only from the
   processor's signed webhook. Stripe/PayPal/Razorpay will not accept this
   category.
2. **KYC** — admin reviews documents manually. Add Sumsub/Veriff for automated
   ID + liveness checks at scale; retain records (legal requirement).
3. **TURN server** — P2P video fails for ~15% of users without TURN
   (coturn, or a managed service). Add credentials in `components/VideoRoom.tsx`.
4. **Uploads** — verification photos are stored on local disk (`uploads/`);
   move to S3-compatible private storage.
5. **Moderation** — add report/block, session recording policy, and geo-blocking
   per your legal advice. 18+ terms pages need real content.
6. **Postgres + scaling** — swap SQLite for Postgres; move the matching queue
   to Redis if you run more than one server instance.
