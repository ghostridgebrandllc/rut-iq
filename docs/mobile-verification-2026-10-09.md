# Mobile map verification — October 9, 2026

Scope: existing Rut IQ main branch, Render service srv-db46tgcs728c739pjj00, and Supabase project ddxzyzjsqrnputiibdbi. Starting release f0c3d63. No Woods IQ, social app, Stripe catalog, or billing changes.

## Changes
- Restrict the half-width layout to wide landscape screens; short portrait screens retain full-width search and county panels.
- Keep filter controls above the legend, add Done and Clear search actions, and close stale county details on state/nation changes.
- Keep county actions visible while long details scroll; enlarge close, zoom, layer, and filter touch targets.
- Use the visual viewport for map sizing during keyboard/browser chrome changes; collapse extra map UI during phone search and dismiss input focus on submit.
- Add safe-area spacing, 16px form fields, focus handling, navigation labels, and selected-layer state.
- Clear private search markers and ignore late search responses after clearing.
- Preserve the map center across hidden-tab resizes and repeated navigation; only resize Leaflet while the map is visible.
- Version the app.js URL.

## Checks before deployment
- Existing tests/browser.cjs guest suite also passes after the map-center correction: repeated tab/viewport changes, Free locks, disabled checkout, and mocked OTP request format.
- tests/mobile_map.cjs: Chrome mobile emulation at 320x568, 375x667, 390x844, 430x932, 844x390, and 390x400. Filter Done, county action bounds, no horizontal overflow.
- Actual map tap selects Tuscaloosa County; Use this county updates Home. All three map layer controls, live Northport city search, clear search, history navigation, Free gates, and disabled checkout pass without JavaScript errors.
- Keyboard visual-viewport geometry and search provider failure are simulated. These are not physical iPhone tests.
- Visually inspected settled 320px county sheet, 390px map, and landscape county sheet.
- Existing account deletion handler tests and server.py tests pass locally. This does not verify a real account deletion or activate the safer server.
- Existing membership-security.sql rerun in a rolled-back transaction: automatic Free, ownership/isolation, QA hiding, report aggregation, Daily Report, tester Pro, expiry, and subscription status checks pass. Fixtures were never committed or publicly visible.
- Current database baseline before/after rollback: 0 users, 0 memberships, 0 reports.

## Still unverified / blocked
- Physical iPhone Safari keyboard, notch/home indicator, installed Home Screen mode, and received email sign-in.
- Real signed-in report submission and account deletion for this release. No existing authorized tester account was available; no sign-in email was sent.
- Server HTTP headers remain inactive: Render still starts python -m http.server. The connected Render tools cannot update the start command, and no Render CLI/API key is available in the Mac shell. Do not claim server.py is active.
- Checkout remains disabled. No new historical comparisons or county alerts were added.

After deployment, run RUT_TEST_URL=https://rut-iq-preview.onrender.com/ node tests/mobile_map.cjs and confirm the deployed commit matches main.
