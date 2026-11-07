# NOXIRA Launch Checklist (Module 10)

Status: NOT launched. Everything below must be closed before the public site
and real student traffic go live. Owner decisions are marked [OWNER]; blocked
technical items are marked [BLOCKED].

## Owner decisions still pending [OWNER]
- Public support contact email (referenced by all four policy pages).
- Deadline extension rule (public wording currently says deadlines are strict;
  the extension policy itself is intentionally undisclosed until decided).
- Detailed data retention schedule (pending final legal review).
- Hosting provider and domain name.
- First launch month / first batch date.
- Programme content (owner writes each programme's tasks/material).
- Google Forms (Form 1 / Form 2) are created by the owner, not by the team.
- Skill test duration: 45 minutes per test is a PROVISIONAL default
  (configurable per course), awaiting owner decision.
- Skill certificate pricing/release: auto-issuance stays OFF in production
  (SKILL_CERT_AUTO_ISSUE) until the owner decides whether certificates are
  free, paid, or manually released.
- Question bank quality: all 12 banks (600 original MCQs) are agent-authored
  and need owner review before launch.
- Certificate visual design: the skill certificate PDF is a clean default
  layout, not owner-approved branding.
- Real company social links for the footer (currently omitted).
- Udyam/registration details, if the owner wants them displayed.

## Technical gates [BLOCKED]
- Real email delivery test: all email so far is simulated/queued locally.
  Requires owner-approved SMTP credentials (via vault, never in chat) and an
  explicit go-ahead to send real mail.
- Production deploy: no hosting/domain chosen, so nothing is deployed.
  `validateEnv` already refuses to boot in production with mock SMTP.

## Verified complete (local, dummy data)
- Modules 1-9 implemented and tested (see git history, branches
  fix/module-3-review-fixes .. feat/module-9-certificate-gate).
- Public policy pages live at /terms, /privacy, /cookies, /payment-refund,
  /review-rules with pending items visibly flagged on-page.
- Student accounts with OTP email verification (mock transport in dev),
  ownership-gated applications/offers, 12 skill courses with server-timed
  quizzes, and skill certificates (PDF + QR verification, owner-gated
  issuance). 41/41 server tests green on branch feat/skill-courses.
- Legacy note: application IDs generated before 8 Nov 2026 are 6 chars
  (~30 bits); new IDs are 12 chars (~60 bits). Both are accepted; consider
  reissuing IDs if real volume approaches.
