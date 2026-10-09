# Email/password sign-in and Remember me

Implemented October 9, 2026. Uses the existing Rut IQ Auth project and accounts. No membership, reporting, checkout, Woods IQ, or social-app changes.

- Password login is the primary sign-in option. New accounts require email confirmation; successful sign-in returns Home.
- Existing email-link users can set a password under My account without replacing their account or reports. Email sign-in remains available.
- Reset requests use Auth recovery email; a verified recovery callback opens My account's new-password form and removes token fragments from the URL.
- New passwords require 12–128 characters in the UI. Provider policy also applies. Passwords are sent only to Auth over HTTPS, never saved in browser storage by the app.
- Remember me stores the session in localStorage. Unchecked uses sessionStorage only. Browsers may restore sessionStorage when restoring a closed tab; shared-device users should sign out. The setting applies to this browser, not all browsers/apps on the device.
- Existing saved sessions retain their persistence. Account settings can change persistence without a password change. Sign-out clears both stores and broadcasts to other tabs. Pending refresh results cannot restore a session after logout.

Verification: tests/password_auth.cjs intercepts all Auth requests (no real emails, accounts, or password changes) and checks password login/Home, confirmation signup, invalid credentials, storage placement, new tabs/reloads, refresh, cross-tab logout, password mismatch/update, recovery routing/token cleanup and 320/390/844px overflow. Existing welcome, private Test Mode, and deletion handler tests passed. Live provider settings show email auth and email confirmation enabled; the real password endpoint rejected invalid fixture credentials as expected.

Still requires a real user's end-to-end password creation/sign-in and recovery email delivery check on iPhone. Automated browser verification does not establish that physical-device result.
