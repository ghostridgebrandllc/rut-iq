# Rut IQ report and entitlement verification — 2026-10-09

Scope: Rut IQ only, live frontend b2faf59a530a77a33a183e1992ecdb8a386aba9a and Supabase project ddxzyzjsqrnputiibdbi.

## Completed

- Baseline: one real auth account, one membership, zero reports, zero QA accounts.
- Created a separate temporary QA account with trusted app_metadata.rut_iq_qa=true before any report submission. Automatic Free membership verified.
- Live Chrome browser at 390px: real QA authentication API login, email-token callback routing to Home, session refresh, county selection, report submission, confirmation, sign-out. Login used an administratively provisioned QA password, not an email inbox.
- Submitted one explicitly labeled QA observation. Database status was hidden; public county counts stayed empty. No fabricated public hunting activity was published.
- Free restricted Pro RPC and map modes; self-upgrade was rejected. Authorized tester Pro enabled behavior mode and 30-day mode. Expired tester access was denied. No JavaScript errors observed in these checks.
- Existing membership-security.sql passed in a rolled-back transaction, covering seven-/30-day aggregates and Daily Report calculations with fixtures never visible to other sessions.
- Real self-service deletion RPC: wrong confirmation rejected; DELETE removed the temporary QA account; subsequent use of the deleted session rejected.
- QA credentials/session files removed. Final database counts restored to one account, one membership, zero reports, zero QA accounts.
- Updated browser regression test expectations for Home callback routing and required explicit county selection.

## Still unverified or pending

- Physical iPhone report submission, map interaction, and deletion UI remain unverified by the agent. Chrome mobile emulation is not a physical iPhone test.
- The user reported that the fresh email sign-in link worked after Site URL and allowed redirect were corrected. Sender/template branding remains pending custom SMTP approval/setup.
- Live report-to-public-map color changes have not been demonstrated using an actual hunter observation. Hidden QA submission and transactional aggregation checks are separate evidence.
- Prepared security-header server remains inactive. Paid checkout remains disabled.
