# Approved signed offer template

The approved NOXIRA background has a fixed **4 Weeks** duration. The PDF includes the signature, stamp, logo, footer and static terms. Those elements must not be redrawn by the renderer.

## Approved asset location and durability

The approved signed blank PDF background has been explicitly approved for inclusion in the repository at:
`server/src/assets/2-NOXIRA-approved-offer-background.pdf` (commit `474c5cf6d7b8a90d85be68973b4c07c9c1f477a7`).

Its SHA-256 is:
`461dacc94ceb2c1ab47b2adf6366aebbc844e41258894dff85c61d3af57ebaee`

Runtime uploads, private manifests, and candidate-issued letters continue to reside exclusively in private authenticated server storage (`server/storage/certificates/`), never in git or public client bundles.

In local development environments without an external MongoDB connection (using the embedded MongoMemoryServer fallback), a scoped restore automatically ensures this approved template is provisioned and restored as active across server restarts using the private disk storage.

1. Deploy this feature, sign in to the existing admin console and open **Offer Letter Studio**.
2. Upload that PDF. The authenticated server stores it privately and recognizes its hash. It preloads all seven tested field positions from `server/src/config/approvedOfferFields.json`. Other PDFs retain the generic starter mapping.
3. The upload is an **inactive draft**, not a live switch. Inspect Preview PDF. Preview uses dummy applicant data, a 4-week example programme and a start date, with a sample watermark. Upload and preview do not send email.
4. In **Programmes**, set the real programme Start Date and duration to 4 weeks. This background rejects other durations and missing `startDate`, rather than printing contradictory terms or a schema-generated fallback date. Existing template backgrounds keep their previous behavior.
5. After checking the preview, explicitly activate the draft. Activation changes the background for subsequent offer generation. It does not replace PDFs already issued.

Merging code does not upload or activate the private asset. No production database update or letter delivery is part of this change. Before activating in a production environment, review existing queued offer jobs and delivery settings through the normal operating process. Do not run a bulk trial or send live letters just to test placement.

## Change placement later

Select the custom template in Offer Letter Studio. Drag an overlay marker, or edit X/Y (points from top-left), font size, width and alignment. Touch dragging captures the pointer. Save Draft Layout, inspect Preview PDF, then explicitly activate the draft.

Editing an active template creates a new inactive version and preserves the previous active layout and PDF hash. Editing an inactive draft updates that draft. Keep all seven field IDs: `applicationId`, `issueDate`, `studentName`, `email`, `phone`, `programTitle`, `startDate`. Ref is the real application ID, not a new serial-number scheme. Candidate name, programme and ref are rendered bold by the existing renderer. Dates use the renderer's existing format.

To move the signature, stamp, footer or other baked graphics, prepare a new background and upload it as a new draft. Its hash will differ, so the seven-field preset will not be applied automatically. Configure and test its mapping instead of assuming the old coordinates still fit.

## Verification

```sh
cd server
npm test
npm run test:approved-offer
# Optional exact-asset HTTP and generation test, isolated in-memory database:
NOXIRA_APPROVED_OFFER_PDF=/absolute/private/path/to/approved.pdf npm run test:approved-offer
```

The additional suite checks the mapping and compatibility guards without an asset. With the private input it also exercises authenticated upload, preview, explicit activation, immutable active-layout edits, actual application-to-PDF generation, queued-but-unprocessed email and rejection of a non-4-week programme. It uses only a disposable database. It never starts the delivery worker or sends email. `NOXIRA_OFFER_TEST_OUTPUT=/private/output/directory` optionally saves synthetic proof PDFs; never commit them because they contain the reusable signature.

Also run client lint, tests and build. Visually inspect normal and long dummy data and the editor at desktop/mobile widths before deploying. The existing renderer shrinks long values to a minimum font size; it does not wrap arbitrary-length text. Preview unusually long applicant/programme names before issuance and adjust placement/width if necessary.
