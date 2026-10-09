# Rut IQ authentication emails

## Current status — October 9, 2026

Custom SMTP is disabled on Supabase project `ddxzyzjsqrnputiibdbi`. The built-in email service was restored after real signup requests failed with SMTP 535 Authentication credentials invalid. A subsequent confirmation request returned HTTP 200. Inbox receipt and link completion remain user checks.

Disabling custom SMTP resets hosted email templates to defaults and restores the built-in limit of two emails per hour. The branded templates below are preserved here, but are NOT currently active.

## Prepared branding

- Confirm sign up: `confirmation.html`; subject: **Confirm your Rut IQ account**
- Magic link or OTP: `magic_link.html`; subject: **Your Rut IQ sign-in link**
- Intended sender: **Rut IQ <rut-iq@auth.ghostridgebrand.com>**
- SMTP: `smtp.resend.com`, port `465`, username `resend`.
- Dedicated Resend sending-only key: **Rut IQ Supabase Auth SMTP**, restricted to the verified sending domain.
- Credentials belong only in the SMTP password setting; never commit them or expose them to the frontend.
- Preserve `{{ .ConfirmationURL }}`. The app handles authenticated returns to Home.
- A Git push does not update hosted email templates.

Earlier checks verified template persistence, 390px browser rendering without overflow, and direct SMTP authentication with the dedicated key. Those checks did not validate the credential saved by the dashboard: actual Supabase email requests subsequently failed. Remote password field edits did not resolve that failure.

Before re-enabling: save the correct credential through a working dashboard input, reapply both templates, and verify one authorized real confirmation send through Supabase plus email provider delivery status. Do not treat a standalone SMTP login as end-to-end verification.

Woods IQ credentials and settings are unchanged.
