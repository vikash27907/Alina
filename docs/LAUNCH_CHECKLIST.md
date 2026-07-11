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

All ten documents are drafted and live at `/legal/*` (source: `content/legal/*.md`).
Before launch: fill the [BRACKETED] placeholders (company legal name, registered
address, city of jurisdiction, Grievance Officer name) and get a lawyer's review —
especially of the Terms, Creator Agreement and Privacy Policy.

- 🔶 Terms of Service — drafted (IT Act/IT Rules/CPA anchored); needs entity details + lawyer review
- 🔶 Privacy Policy — drafted (DPDP Act 2023 + GDPR/CCPA sections); needs entity details + lawyer review
- 🔶 Community Guidelines — drafted; operational, low legal risk
- 🔶 Acceptable Use Policy — drafted (mirrors Rule 3(1)(b) IT Rules 2021)
- 🔶 Creator Agreement — drafted (contractor status, earnings, TDS, payout freeze rules); lawyer review strongly advised
- 🔶 Refund & Cancellation Policy — drafted with CPA-2019-compliant exceptions
- 🔶 Content Removal / Copyright Policy — drafted (24h/36h IT Rules timelines + DMCA-style notice flow)
- 🔶 Age Policy — drafted
- 🔶 Cookie Policy — drafted (accurate to the single auth cookie actually used)
- 🔶 Grievance Redressal Policy — drafted; REQUIRES appointing a real Grievance Officer (a named resident Indian employee/officer) before launch

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

- ✅ Report user in-call (both directions, with reason) → admin review queue
- ✅ Block user in-call — blocked pairs are never matched again
- ✅ Suspend (timed) / permanently ban accounts from admin panel; enforced at
  login and on live socket connections
- ✅ Payout freeze / unfreeze for models under investigation
- ✅ Audit log (admin logins, approvals, payouts, moderation actions, failed logins)
- ✅ Support ticket system (any user → admin inbox, threaded replies)
- ✅ Automated explicit-content filter on all text chat (warnings → 1/5/30-min
  timeouts → 24h auto-suspension, all logged to audit trail)
- ✅ Auto-timeout on report bursts (3 reports in 15 min → 30-min timeout + admin flag)
- ⬜ ML-based video nudity detection for live streams (rely on reports + timeouts for MVP)
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
