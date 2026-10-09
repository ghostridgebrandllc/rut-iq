# Membership verification — 2026-10-09

Scope: Rut IQ repository, Render service srv-db46tgcs728c739pjj00, Supabase project ddxzyzjsqrnputiibdbi only. Woods IQ not modified.

Original requested deploy dep-db4872ks728c739ttbrg failed. Retry dep-db48fqks728c739uqfc0 successfully served commit 143e74b.

## Implemented

- Narrowed raw report and membership grants; removed client write/TRUNCATE permissions beyond report-column INSERT. Ownership enforced by RLS.
- Free exposes 7-day county counts and the approved Daily Rut Report. Pro-only individual behavior data and advanced county summaries require server-verified membership. Public views use security_invoker; narrowly scoped aggregation functions live in a non-API schema.
- Tester expiration matches server entitlement checks. Browser session refresh, token callback handling, cross-tab sign-out, local sign-out, and session error messages added.
- Report submission refreshes county counts, Daily Rut Report, map colors and popups. State can be selected directly on the report form. Multi-page county retrieval avoids the default 1,000-row REST cap.
- Phone layouts tested at 320, 375, 390, 430 px. Narrow selects, plan pricing, buttons and map layer controls fit without horizontal overflow.
- Separate inactive Rut IQ product and monthly/yearly prices prepared in existing Stripe sandbox. No live billing or checkout enabled.

## Evidence and limitations

`tests/membership-security.sql` passes against the Rut IQ database inside a rolled-back transaction: Free trigger, membership isolation, self-upgrade denial, report owner spoof denial, protected moderation fields, raw report isolation, 7/30-day aggregates, Daily Rut Report, authorized tester access, expired tester denial, missing Stripe period denial, active Stripe entitlement, past-due denial. Fixtures never become visible to other sessions.

`tests/browser.cjs` uses the existing Chrome/Puppeteer installation. Guest navigation/layout, disabled checkout and Free feature locks passed. Real Supabase QA account tests passed for callback, session refresh, Free report INSERT (automatically hidden), authorized Pro, expired Pro, and sign-out. The QA account is provisioned administratively for testing, not through an email-delivery test. QA credentials/session files are temporary and are not part of the repository.

Email request format/redirect and confirmation UI are tested with an intercepted response. Actual email delivery and a hunter opening a received magic link remain UNVERIFIED and require a real inbox check. Do not describe email onboarding as fully verified until that check passes.

The Daily Report and map aggregate data paths were exercised transactionally; browser report submission refreshes those endpoints. No real hunter sightings exist yet, and no artificial sightings were published.

Security advisor showed no database/view/function findings after the migration. While the temporary password-based QA account existed, Auth warned that leaked-password protection was disabled. The app uses email links; password onboarding is not exposed by the UI. Do not claim password policy was changed.

Initial real-account baseline: 0 accounts, 0 memberships, 0 reports. Remove only the temporary QA account and its sessions/reports after verification; compare final baseline before closing.

## Repeating tests

Run guest tests with `node tests/browser.cjs guest`; set RUT_TEST_URL to the deployed URL for live testing. For real-session tests, provision an isolated QA user with trusted app metadata `rut_iq_qa=true`, store its random credentials only in /tmp/rut-iq-qa.json (mode 0600), and run free/pro/expired after assigning the corresponding entitlement. Never reuse a hunter account or publish test sightings. Revoke sessions and delete only the QA user afterwards.
