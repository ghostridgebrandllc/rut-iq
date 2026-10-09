# Rut IQ authentication emails

## Current status — October 9, 2026, 16:19 UTC

Custom SMTP is ENABLED on Supabase project ddxzyzjsqrnputiibdbi. The dedicated credential was entered through the unlocked Mac dashboard and saved. Reloading the SMTP screen confirmed it remained enabled. No Woods IQ credentials or settings changed.

- Sender: **Rut IQ <rut-iq@auth.ghostridgebrand.com>**
- SMTP: smtp.resend.com, port 465, username resend.
- Dedicated sending-only key: Rut IQ Supabase Auth SMTP, restricted to the verified sending domain. Credential remains only in the SMTP setting; never commit it.
- Confirm sign up: confirmation.html; subject **Confirm your Rut IQ account**.
- Magic link: magic_link.html; subject **Your Rut IQ sign-in link**.
- Both hosted templates were saved. After reloading, the magic-link subject and full editor contents matched the repository.
- Preserve {{ .ConfirmationURL }}. A Git push does not update hosted templates.

## Delivery evidence

An authorized real Supabase confirmation request returned HTTP 200. Resend message 01a12175-f1c9-7dbe-b652-6114f785d30a was sent at 16:19:00 UTC and reported delivered. Its sender, subject and HTML/plain-text branding were verified. The confirmation link's redirect_to points to https://rut-iq-preview.onrender.com/. The private link/token was not opened or committed.

This proves provider-reported delivery of one actual confirmation email. Recipient inbox viewing, clicking through on a physical iPhone, real returning-user magic-link delivery and delivery to an authorized non-team tester remain unverified. Do not equate an API 200 or provider delivery event with user completion.

## Earlier failure

Earlier dashboard credential attempts returned SMTP 535. Custom SMTP was temporarily disabled, restoring the restricted built-in service and resetting hosted templates. That rollback is superseded by the successful configuration and delivery above.
