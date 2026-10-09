# Personal field dashboard — October 9, 2026

## Features
1. Free saved counties: up to ten counties per browser, one Home preference, quick switching and removal. Preferences are local, not account-synced. Account deletion clears them.
2. Home: real approved reports submitted since the last successful Home visit, within the last seven local calendar days. First visit explicitly establishes a starting point. Failed loads do not advance it. Repeated refreshes within a page visit retain the original baseline. Pro adds new-report behavior totals; Free retains basic counts and the existing Daily Report.
3. Nearby counties: basic seven-day counts, up to six ranked counties, derived from exact shared polygon edges in existing map assets. This does not assert exhaustive or updated geographic adjacency. Coverage exists for 3,136 of 3,143 canonical counties; unavailable areas are labeled. Regenerate with scripts/build_county_neighbors.py.
4. Pro comparison: two equal completed seven-day periods, excluding today, with actual reports, unique hunters, behavior counts and exact date ranges. Sparse/zero data is labeled; no predictive trend is inferred. At least five reports from three hunters in each period is required for the count-change headline. All RPC access is backend-verified, including revoked memberships.
5. Submission receipt: captured report county, behavior and date; explicit private-QA wording; county map zoom and another-observation actions.
6. Install experience: Rut IQ icon assets, web manifest, standalone mode, branded boot screen, safe-area support and instructions under More. A minimal service worker caches only the reconnect page; auth, reports and tiles always use the network. No offline reports, offline map claim or push alerts.

Database migration applied: rut_iq_premium_county_summaries. Source: database/premium_county_summaries.sql. Public invoker wrappers call private, restricted aggregate helpers. Responses contain no hunter identities, emails or notes.

## Verification
- tests/premium_summaries.sql passed before and after migration in rolled-back transactions: first visits, QA exclusion, seven-day bounds, equal completed periods, distinct hunters, invalid county rejection and anonymous/Free/Pro/revoked-Pro boundaries. No fixtures published; post-test counts: zero reports, zero QA users.
- tests/premium.cjs passed against the local server: saved/preferred counties across reload/removal; real zero-data first visit and nearby counts; browser-intercepted return counts/Pro comparison/QA submission; exact-county map and another-report actions; install assets, phone overflow, and offline fallback. No test email or report sent to the backend.
- Existing mobile_map, welcome, audit_regressions and account_deletion_ui suites passed. Six map viewports covered 320–844px and simulated keyboard height; no app JavaScript errors observed.
- Home and 192px icon visually inspected. Startup-order and saved-list refresh/focus issues were corrected during testing.
- Existing security advisor findings remain: deliberately inaccessible private county reference table has RLS/no policy; leaked-password protection is disabled (app currently uses passwordless email). No new function advisor findings.

## Outstanding
Dedicated branded SMTP was successfully enabled after the Mac became accessible. One real confirmation email returned HTTP 200 and was reported delivered by Resend at 16:19 UTC, with the Rut IQ sender, subject, branded contents and live-site redirect verified. Returning-user magic-link delivery, non-team tester delivery, recipient click-through and a physical-iPhone installed-app flow remain unverified. Browser-intercepted auth/report tests are not end-to-end delivery evidence. Render auto-deployment/Git integration is unresolved; manually deploy and verify the current release. Checkout remains disabled. No Woods IQ or social-app changes.

## Live release verification
Commit 5693ae1bc14b928f5ed57550e629679dad4dd7b9 deployed as dep-db4h5k7lot8c73900deg, live at 16:14:44 UTC October 9, 2026. All 11 public release assets matched the repository byte-for-byte, with security headers intact. The premium, mobile_map and welcome browser suites passed against the live URL, including safe offline fallback and mocked report/callback flows. No browser fixtures reached the report database or sent email. The separate real confirmation request above was authorized and verified through provider metadata.
