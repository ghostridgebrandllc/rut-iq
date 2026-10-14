# Field Talk automated photo scanning

Beta only. Edge Function `rut-field-photo-scan` (JWT-required) is deployed in Supabase.

The client JPEG-reencodes uploads, stores them in the private `rut-field-photos`
bucket, then calls the Edge Function with the newly registered `photo_id`.
The function authenticates the caller, verifies the photo's ownership, reads
the private object, verifies the JPEG signature, and submits it to
OpenAI's `omni-moderation-latest` endpoint for image moderation.

**Activation prerequisite**: Set secret `OPENAI_API_KEY` in the Supabase
project Edge Function environment. There is no key committed in the repo.
Without this key, scans do not run, photos remain `pending` and database
guards prevent moderator approval.

Scan outcomes: `clean`, `flagged`, `error` or `pending`.
Only the privileged service can update scan fields. A `clean` scan does
not publish a photo: a human moderator must still approve it and the
post/reply. Flagged, error and unscanned photos cannot be approved.
The scan cannot establish that a photo is free of precise-location clues
in its visible contents; human privacy review remains necessary.

Before release: configure and verify the provider credential and costs,
test with real authorized accounts and both safe and unsafe images,
test error/timeout behavior, and add a trusted retry workflow for scan errors.
