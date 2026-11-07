# NOXIRA Certificate Management, Issuance & Verification System
*Production-Grade MERN Digital Credential Infrastructure*

---

## 🌟 Overview

The **NOXIRA Certificate System** is an enterprise-grade digital credential platform designed with dual intake paths, strict decoupled completion review, idempotent vector PDF minting, zero-PII public verification, and immutable versioned replacement/revocation lifecycles.

```
Website Form / Google Form CSV
       ↓
Unified Participant Intake (Status: PENDING - never auto-issued)
       ↓
Completion Review Gate (Admin evaluates criteria: ELIGIBLE vs REWORK)
       ↓
Template Studio & Vector PDF Preview (Dynamic font auto-scaling)
       ↓
Durable Issuance Engine (Dual IDs: Human ID + 128-bit Crypto Token)
       ↓
Approved Distribution (Scoped 72-hour private download link)
       ↓
Public Verification Portal (/verify/:token - ZERO PII exposed)
       ↓
Immutable Lifecycle (Revoke or Issue Corrected Replacement)
```

---

## 🌐 Public Website & Student Features

Beyond the credential engine, the repo includes the public NOXIRA site (`client/`):

- **Programme catalogue & status lookup** - 31 internship tracks; applicants check status with email + programme + application ID (identical generic failures; rate-limited).
- **Student accounts** - email+password with OTP email verification (codes stored as hashes, 10-minute expiry), secure session cookie, claim an existing application with its ID.
- **Skill courses** - 12 timed assessments (50 original MCQs each). Server-timed deadlines: answers save as you go and freeze at the deadline; a late submit is scored from answers saved in time only. Results and certificates appear on the student dashboard.
- **Skill certificates** - passing a test can issue a verifiable certificate (PDF download + QR-linked public verification). Auto-issuance is a launch-gated owner decision: in production it is OFF unless `SKILL_CERT_AUTO_ISSUE=true`.
- **Resume readiness check** (`/ats-check`) - transparent, in-browser resume checks. No fabricated "ATS score"; nothing is uploaded.
- **Policies** - Terms, Privacy, Cookie, Payment & Refund and Review Rules pages, all marked as drafts pending owner confirmation and legal review.

### Skill-course safety flags (server/.env)

| Variable | Default | Meaning |
| --- | --- | --- |
| `ALLOW_TEST_HOOKS` | unset (off) | Enables the answer-key endpoint for e2e tests. Also hard-disabled when `NODE_ENV=production`. |
| `SKILL_CERT_AUTO_ISSUE` | unset (off in production) | Auto-issue skill certificates on a pass. Owner release/pricing decision pending. |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js** v18+ (tested on v24.21.0)
- No local MongoDB or Redis required! The backend automatically initializes an embedded in-memory MongoDB instance (`mongodb-memory-server`) for frictionless zero-setup development. (You can also provide a MongoDB Atlas URI in `server/.env`).

### 2. Run Automated Acceptance Tests
```bash
npm test
```
Verifies all 7 core acceptance criteria:
- Admin authentication & password hashing
- Intake duplicate prevention on compound keys
- Completion review decoupling from registration
- Vector PDF generation with 50+ char name scaling & same-day dates
- Durable idempotent issuance (anti-double-click)
- Public verification zero-PII leak protection
- Revocation & replacement version linking

### 3. Seed Super Admin
The administrative seeder script loads environment configuration directly from `server/.env` (using Node.js `dotenv`).

Before running the seeder, ensure your local `server/.env` file exists (copied from `server/.env.example`) and defines your initial admin secret:
```bash
# In server/.env:
INITIAL_ADMIN_PASSWORD=<your_secure_development_password>

# Optional configuration (defaults applied if omitted):
# INITIAL_ADMIN_EMAIL=admin@noxira.com
# INITIAL_ADMIN_NAME=System Administrator
```

Execute the seeder from the repository root:
```bash
npm run seed:admin
```
*(Or from the `server` directory: `npm run seed:admin` / `node src/scripts/seedAdmin.js`)*

**Security & Account Protection:**
- `INITIAL_ADMIN_PASSWORD` is strictly required. If missing or blank, the script halts with a clear error (exit code 1) and never modifies the database.
- If an admin account with the email already exists, the seeder makes no changes and preserves existing credentials.
- To intentionally update an existing admin account's password, pass the `--force-reset` flag explicitly:
  ```bash
  cd server && node src/scripts/seedAdmin.js --force-reset
  ```

### 4. Configure Public Website Intake (Optional for local testing)
Public application intake (`/apply`) requires an owner-configured active cohort batch in `server/.env`:
```bash
WEBSITE_INTAKE_BATCH_ID=<active_cohort_batch_id>
```
If `WEBSITE_INTAKE_BATCH_ID` is unset or blank, public website intake fails closed with HTTP 503 (`Service Unavailable`) and creates zero records.

### 5. Start Server & Client
In terminal 1 (Backend API):
```bash
npm run server
```
*Runs on `http://localhost:5000`*

In terminal 2 (React Frontend):
```bash
npm run client
```
*Runs on `http://localhost:5173`*

---

## 🛡️ Core Pillars & Security Features

| Pillar | Implementation Details |
| :--- | :--- |
| **Two Intake Paths, One List** | Website form (`/apply`) and Google Form CSV exports (`/admin/import`) merge into the same participant pool with status `PENDING`. Compound unique index (`normalizedEmail + program + batch`) prevents silent overwriting. |
| **Decoupled Completion Review** | Registration *never* issues a certificate. An admin must record technical evaluation remarks and explicitly mark candidate as `ELIGIBLE`. |
| **Template Studio & Dynamic PDF** | High-resolution vector PDF powered by `pdf-lib` (~35MB RAM footprint). Adaptive font-size algorithm scales long names (40–60 chars) dynamically so they never clip borders. |
| **Durable Issuance & Dual IDs** | Human-readable ID (`NOX-2026-FSD-0001`) + 128-bit cryptographically secure token (`crypto.randomBytes(16).toString('hex')`). Atomic storage write before marking `ISSUED`. |
| **Zero-PII Public Verification** | Route `/verify/:token` shows verified status, recipient name, course, and dates. **Zero student email or phone exposed publicly.** |
| **Private Scoped Download** | Independent 72-hour scoped download token for student PDF access. Public verification token cannot fetch raw binary. |
| **Distribution & Safe Retry** | Email delivery queue with state machine (`QUEUED`, `PROCESSING`, `PROVIDER_ACCEPTED`, `DELIVERED`, `FAILED`). Timeouts flag for review rather than blind resend. |
| **Immutable Replacement & Revoke** | Issued certificates are never silently edited. Corrections mint a linked Version 2, marking old as `REPLACED` with public redirection. |

---

## ☁️ 100% Free Production Deployment Guide

| Layer | Recommended Free Host | Configuration Notes |
| :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) / [Cloudflare Pages](https://pages.cloudflare.com) | Point build command to `npm run build`, output directory `dist`. Set `VITE_API_URL`. |
| **Backend** | [Render.com](https://render.com) / [Koyeb](https://koyeb.com) | Free Web Service (512MB RAM). Start command: `npm start`. Set environment variables from `server/.env.example`. |
| **Database** | [MongoDB Atlas (M0 Sandbox)](https://www.mongodb.com/cloud/atlas) | 512MB storage, free forever, replica set with full ACID transactions. Set `MONGODB_URI` in server environment. |
| **PDF Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) | 10 GB free storage every month with **$0 egress/bandwidth cost**. |
| **Transactional Email** | [Resend](https://resend.com) / [Brevo](https://brevo.com) | 3,000 emails/month free tier with custom domain DKIM/SPF verification. |

---

## 📁 Repository Directory Structure

```text
noxira_technologies/
├── package.json               # Root scripts (test, seed:admin, server, client, build)
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── config/            # db.js (Atlas & in-memory fallback), env.js
│   │   ├── models/            # Admin, Participant, Program, Template, Certificate, DeliveryJob, AuditLog, ImportBatch
│   │   ├── controllers/       # Auth, Intake, Participant, Template, Certificate, Verify, Distribution, Audit
│   │   ├── services/
│   │   │   ├── pdfService.js     # Vector PDF rendering & dynamic font auto-scaler
│   │   │   ├── qrService.js      # 128-bit high-entropy token & QR generator
│   │   │   ├── storageService.js # Private storage & SHA-256 integrity check
│   │   │   └── emailService.js   # Scoped download link mailer & reconciler
│   │   ├── middleware/        # Auth, RBAC, Multer CSV upload, Rate Limiting, Error Handler
│   │   ├── routes/            # REST endpoints
│   │   └── scripts/           # seedAdmin.js, seedDemoData.js
│   └── tests/
│       └── runAllTests.js     # 7 comprehensive acceptance tests
│
└── client/
    ├── package.json
    ├── tailwind.config.js
    ├── src/
    │   ├── pages/
    │   │   ├── ApplyPage.jsx           # Public Candidate Intake Form
    │   │   ├── VerifyPage.jsx          # Public Zero-PII Verification Portal
    │   │   ├── AdminLoginPage.jsx      # Admin Authentication
    │   │   ├── DashboardOverview.jsx   # Metrics & Workflow Hub
    │   │   ├── ParticipantsPage.jsx    # Completion Review Gate
    │   │   ├── CsvImportPage.jsx       # Google Form CSV Import Wizard & Deduplication
    │   │   ├── TemplatePreviewPage.jsx # Vector Template Studio & Long Name Elasticity Test
    │   │   ├── IssuanceBatchPage.jsx   # Batch Approval & Minting Gate
    │   │   ├── CertificatesPage.jsx    # Certificate Registry, Revocation & Replacement Modals
    │   │   ├── DistributionPage.jsx    # Email Queue & Safe Retry
    │   │   └── AuditLogsPage.jsx       # Immutable Event History
    │   └── services/
    │       └── api.js                  # Frontend API client
```

---

*Engineered with precision for NOXIRA Technologies.*
