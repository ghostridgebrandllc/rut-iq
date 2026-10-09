# Render server activation — October 9, 2026

Rut IQ service `srv-db46tgcs728c739pjj00` now starts with `python server.py`. Changed only this service through Render Settings.

Deployment `dep-db4g11c9v7es73ah29f0` became live at 14:56:17 UTC, running frontend commit `b2faf59a530a77a33a183e1992ecdb8a386aba9a`. The subsequent repository changes contain tests, documentation, and email templates only.

Verified live:
- Home, app.js, and maps/01.json return 200.
- server.py, database/self_service_deletion.sql, and .git/config return 404.
- Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and Strict-Transport-Security are present.
- Existing welcome test passed, including simulated authenticated Home routing.
- Existing mobile map suite passed at 320x568, 375x667, 390x844, 430x932, 844x390, and 390x400.
- County tap/actions, filters, layers, live city search, simulated keyboard behavior, navigation, Free gates, and disabled checkout passed with no JavaScript errors observed.

These are automated Chrome viewport checks, not physical iPhone testing or a new comprehensive security audit.

Rollback: restore the previous start command, `python -m http.server $PORT --bind 0.0.0.0`, in this service's Render Settings if necessary. That rollback removes the server header and asset-allowlist protections.

Woods IQ, other services, and billing were not changed.
