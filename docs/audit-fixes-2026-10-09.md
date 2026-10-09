# Rut IQ audit fixes — October 9, 2026

## Implemented
- Wait for county geography before initializing state/FIPS map controls, including slow mobile loads.
- Enforce canonical state/county pairs in PostgreSQL against the existing 3,143-county geography.
- Use the viewer's local calendar date consistently for report windows. Server validates the supplied date within the current global timezone range (UTC ± one day); arbitrary historical dates are rejected.
- Compute Pro behavior charts from complete backend aggregates, independent of the latest-200-report feed. Label the feed cap clearly.
- Give distinct email service-limit, delivery, network and timeout messages, and a 60-second resend cooldown. This improves feedback; it does not repair SMTP delivery.
- Keep resend ticks isolated from account-management UI.

Database migration applied: rut_iq_audit_counties_and_local_calendar. Source: database/audit_fixes.sql.

## Verification before deployment
- Six mobile/landscape/keyboard-height viewport regressions passed, plus welcome/sign-in routing and account deletion handler tests.
- Delayed-geography regression verified 52 state-select options and 3,143 FIPS lookups.
- Browser-only fixtures verified local date across UTC midnight, complete 210-report totals with a 200-item feed, hourly-limit feedback and network recovery. These fixtures sent no emails or reports.
- Transactional SQL rollback tests passed after applying the migration: invalid counties rejected, date limits, Free/Pro gates, QA hiding and complete aggregates verified. No test users or reports persisted; subsequent counts were zero reports and zero QA users.
- Syntax and whitespace checks passed.

## Still outstanding
- Dedicated SMTP delivery remains disabled after the earlier failed credential save. Default Supabase delivery is restricted and not suitable for public launch. Branded email templates remain prepared in the repository, not active.
- A fresh real signup email, confirmation, Home redirect and report submission still require end-to-end verification.
- Render Git integration/automatic deployment remains unresolved; verify the release via manual deployment and live asset comparison.
- Physical iPhone keyboard/safe-area behavior remains unverified; automated viewport checks do not establish physical-device completion.
- Checkout stays disabled. No Woods IQ changes.

## Live verification
Release d1f261072fabe13cfb417932999f4c8724fd4141 deployed as dep-db4gol7avr4c73eeivig, live at 15:47:06 UTC October 9, 2026. Live index.html and app.js matched the committed files byte-for-byte. Security response headers remained active.

After deployment, audit_regressions.cjs, mobile_map.cjs and welcome.cjs passed against the live URL. This covered all six mobile viewport sizes, delayed geography, real city search, county actions, guest gates, disabled checkout, and mocked authentication/callback routing. No app JavaScript errors were observed. The first regression run started before the deployment finished and timed out on the old geography race; the post-deployment run passed.

Email settings could briefly be inspected on the Mac, but the screen locked again before credentials were entered or saved. No SMTP configuration change was saved. Dedicated branded delivery and real inbox/link completion remain unverified.
