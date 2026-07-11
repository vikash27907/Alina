# FunWithU — Launch Compliance & Readiness Checklist

Track everything needed before accepting the first paying customer.
Status legend: ✅ done in code · 🔶 partially done / stubbed · ⬜ not started

## 1. Platform rules (decide FIRST — everything else depends on this)

- ⬜ Written decision: **Scenario 1 (general adult social — no explicit content)**
  or Scenario 2 (explicit content). This determines which payment providers,
  laws, and moderation tools apply. Scenario 1 strongly recommended for launch.
- ⬜ Exact list of what is allowed/prohibited during calls, in chat, in gifts.
- ⬜ Enforcement ladder: warning → suspension → permanent ban → payout freeze.

## 2. Legal documents (draft → lawyer review → publish)

- ⬜ Terms of Service
- ⬜ Privacy Policy (India DPDP Act 2023; GDPR if serving EU users)
- ⬜ Community Guidelines
- ⬜ Acceptable Use Policy
- ⬜ Creator (Model) Agreement — independent contractor terms, payout terms, tax responsibility
- ⬜ Refund Policy — non-refundable *by default* with defined exceptions:
  technical failure on our side, duplicate charges, fraudulent transactions,
  service not delivered as described
- ⬜ Content Removal / Copyright (DMCA-style) Policy
- ⬜ Age Policy (18+ statement + verification method)
- ⬜ Cookie Policy
- ⬜ Grievance Officer & contact details (required for Indian intermediaries under IT Rules 2021)

## 3. Company & money

- ⬜ Register company (Pvt Ltd / LLP) — payment providers require a legal entity
- ⬜ Business bank account, GST registration as applicable
- ⬜ Payment processor application (describe the platform accurately):
  Scenario 1 → try mainstream providers first; Scenario 2 → Segpay/CCBill/Epoch only
- ⬜ Credit coins ONLY from processor's signed webhook (replace demo checkout in
  `app/api/coins/purchase/route.ts`)
- ⬜ Chargeback handling process and refund workflow
- ⬜ Model payout rails (UPI/bank/Paxum) + TDS/tax withholding advice from a CA

## 4. Verification

- ✅ Model application requires government ID + selfie-with-ID upload
- ✅ Server-side 18+ date-of-birth check
- ✅ Admin manual review queue with private document viewer
- ⬜ Automated KYC + liveness (Sumsub / Veriff / HyperVerge) when volume grows
- ⬜ ID record retention policy (what's stored, where, for how long)
- 🔶 Customer age gate: self-declared 18+ checkbox exists; stronger verification
  may be required depending on target markets

## 5. Moderation & safety tooling

- ⬜ Report user (in-call + profile) with reason categories
- ⬜ Block user
- ⬜ Suspend / ban accounts from admin panel (emergency one-click)
- ⬜ Payout freeze on models under investigation
- ✅ Audit log (admin logins, approvals, payouts, failed login attempts)
- ⬜ Chat log retention — only where disclosed in the Privacy Policy
- ⬜ Moderator role (separate from full admin)
- ⬜ On-call escalation process for serious reports

## 6. Technical security

- ✅ Admin routes require ADMIN role verified against the database on every request
- ✅ Brute-force lockout on login (5 attempts / 15 min per IP+email)
- ✅ Signup and model-application rate limiting
- ✅ Production refuses to boot with a weak/missing AUTH_SECRET
- ✅ Seed refuses weak admin passwords in production
- ✅ Security headers (X-Frame-Options, nosniff, HSTS, Permissions-Policy)
- ✅ Verification documents served only to authenticated admins, path-traversal safe
- ✅ Upload restrictions (size, image types only)
- ⬜ Make GitHub repository **private**
- ⬜ HTTPS via reverse proxy (nginx + Let's Encrypt) on the VPS
- ⬜ Move uploads to private S3-compatible storage with encryption at rest
- ⬜ Postgres + automated backups
- ⬜ TURN server with credentials (video reliability + hides user IPs from each other)
- ⬜ Redis-backed rate limiting + matching queue when scaling past one server
- ⬜ 2FA for admin accounts

## 7. Launch order (do not reorder)

1. Finalize platform rules (Scenario 1 vs 2)
2. Draft legal documents → lawyer review
3. Register the company
4. Build moderation & reporting features
5. Strengthen creator verification
6. THEN approach payment providers with an accurate platform description
7. Soft launch with limited users → monitor → public launch
