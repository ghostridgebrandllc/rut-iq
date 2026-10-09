# Private Test Mode — October 9, 2026

Authorized QA accounts default to a clearly labeled private view after backend verification. More → Test Mode switches between that view and public data; the choice lasts in the current tab. Home, Reports, Log Activity and the map show explicit notices. Switching views never changes report status or publishes test data.

Private aggregates include only hidden reports owned by auth.uid(). New authenticated-only invoker RPCs call private helpers guarded by current database QA metadata and a matching, unexpired auth.sessions record. They accept no target user ID. Existing public RPCs remain unchanged. Pro analyses retain the backend membership requirement. The private map's report-volume mode can show one tester's activity; behavior signal thresholds still require independent hunters and are not weakened.

Migration: rut_iq_private_test_mode; source database/private_test_mode.sql. Private functions mirror the existing public-data date windows and aggregates; keep both sets consistent when those algorithms change.

Switching view clears aggregate caches and invalidates in-flight requests. Private visit markers use an account-specific prefix, separate from public markers. No private report cache is added to local storage or the service worker. Logout/revoked access hides tester controls and clears visible private results.

Validation:
- tests/private_test_mode.sql passed before and after migration, with all fixtures rolled back. Verified own-only data, cross-tester exclusion, unchanged public totals, anonymous/non-QA/mismatched/expired/revoked rejection and preserved Free/Pro gates.
- Read-only transaction verified the owner's actual existing hidden scrape/rub report: private Daily Report 1 report/1 hunter; private map 1 seven-day report; public Daily Report empty. No report status changed.
- tests/private_test_mode.cjs passed locally with browser-intercepted fixtures: private Home/Daily/map, bearer-authenticated RPCs, Free gates, 320/390/844px map controls, public-view toggle/reload, late-response isolation, revocation and logout. No reports or emails sent.
- Existing mobile map, welcome and account-deletion regressions checked alongside this release.
- Security advisors: no new findings; existing private canonical-table RLS/no-policy info and disabled leaked-password-protection warning remain.

Physical iPhone testing of this new private view remains a user check after deployment. No Woods IQ or social-app changes. Paid checkout remains disabled.

## Live verification
Release bed1035445460c67f75f5621bfacd1637788f5c7 deployed as dep-db4hrumi0phs73cbfag0 at 17:02:12 UTC. Served HTML and JavaScript matched the committed files. The private Test Mode browser suite passed against the live URL, including mode switching, stale responses, mobile controls, revoked access and logout. A real unauthenticated REST request to the private county-count endpoint returned HTTP 401. The existing owner test report remains hidden; no reports were published or added during verification.
