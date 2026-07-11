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

```bash
cp .env.example .env       # then edit secrets
npm install
npm run setup              # creates DB + seeds the admin account
npm run dev                # http://localhost:3000
```

Production: `npm run build && npm start`

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
