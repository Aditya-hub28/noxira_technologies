# NOXIRA Launch Checklist (Module 10)

Status: NOT launched. Everything below must be closed before the public site
and real student traffic go live. Owner decisions are marked [OWNER]; blocked
technical items are marked [BLOCKED].

## Owner decisions still pending [OWNER]
- Public support contact email (referenced by all four policy pages).
- Deadline extension: decided 27 Nov 2026, at NOXIRA's discretion only, never
  guaranteed (now on Review Rules page).
- Data retention: decided 27 Nov 2026, certificate and payment records kept as
  needed, other data deleted 1 year after the programme (now on Privacy page).
  Legal check on deletion requests still pending.
- Hosting provider and domain name.
- First launch month / first batch date.
- Programme content (owner writes each programme's tasks/material).
- Google Forms (Form 1 / Form 2) are created by the owner, not by the team.

## Technical gates [BLOCKED]
- Real email delivery test: all email so far is simulated/queued locally.
  Requires owner-approved SMTP credentials (via vault, never in chat) and an
  explicit go-ahead to send real mail.
- Production deploy: no hosting/domain chosen, so nothing is deployed.
  `validateEnv` already refuses to boot in production with mock SMTP.

## Verified complete (local, dummy data)
- Modules 1-9 implemented and tested (see git history, branches
  fix/module-3-review-fixes .. feat/module-9-certificate-gate).
- Public policy pages live at /terms, /privacy, /payment-refund, /review-rules
  with pending items visibly flagged on-page.
