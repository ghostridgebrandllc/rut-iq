# Rut IQ authentication emails

Applied to Supabase project `ddxzyzjsqrnputiibdbi` on October 9, 2026.

- Confirm sign up: `confirmation.html`; subject: **Confirm your Rut IQ account**
- Magic link or OTP: `magic_link.html`; subject: **Your Rut IQ sign-in link**
- Sender: **Rut IQ <rut-iq@auth.ghostridgebrand.com>**
- SMTP: `smtp.resend.com`, port `465`, username `resend`.
- Dedicated Resend sending-only key: **Rut IQ Supabase Auth SMTP**, restricted to the verified sending domain.
- Credentials belong only in the SMTP password setting; never commit them or expose them to the frontend.
- Preserve `{{ .ConfirmationURL }}` in both templates. The existing app handles the authenticated return to Home.
- These files are copied into the Supabase dashboard; a Git push does not update email templates automatically.
- Other email templates remain unchanged.

Verification: sender settings persisted after reload; both subjects and complete HTML were read back from the dashboard; both templates rendered at 390px without horizontal overflow. Dedicated SMTP authentication succeeded without sending an email.

Pending: fresh email delivery through Supabase and rendering/link completion in iPhone Mail. Browser template previews do not establish email-client compatibility.
