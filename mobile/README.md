# Rut IQ — iOS and Android release foundation

Status: preparation only. No store submissions, paid memberships or live billing are enabled.

## Product
- Primary product: recent, actual hunter-submitted rut observations, map and county activity.
- Secondary: Field Talk public forum with moderation.
- Free: live reports, submitting sightings, forum.
- Pro: 30-day analysis, county comparisons and planned native notifications.
- Existing website and Supabase backend remain active; the native apps must use the same account system.

## Preferred mobile stack
Use Capacitor to wrap the existing client with real native plugins for notification permissions, deep links and store purchase flows. Do not merely show the deployed site in a generic WebView. Keep core app content bundled for app-store review and offline loading where reasonable. Review dependency compatibility and licenses before adding native plugins.

The existing app uses a Python static server with CSP and route guards. For packaging, build a dedicated static web directory from only public assets. Do not package database files, secrets, tests, docs or the private beta password. Preserve correct Supabase endpoints but store no service-role credentials in the app.

## Prerequisites
- Apple Developer Program organization membership under Ghost Ridge Brand LLC.
- Google Play Console organization registration and identity verification.
- Consistent organization details and a D-U-N-S number.
- Full Xcode, macOS-supported iOS SDK; Android Studio, Android SDK, JDK.
- Unique iOS bundle identifier and Android application ID, to be finalized before publication.
- Privacy disclosures, terms, account-deletion test, moderation/reporting workflows, support contacts.
- Store listing images and descriptions for each OS.
- Properly managed Apple/Google subscriptions and server-verified entitlements. Existing Stripe sandbox settings do not automatically satisfy mobile-store payment rules.

## Push alerts
Implement native notification registration and secure user/device token storage.
Allow a Pro subscriber to follow counties; use newly received, verified hunter reports as inputs.
Require notification opt-in, deduplicate sightings, group activity, allow quiet hours or frequency limits.
Never send claims of rut activity without qualifying reports; never publish exact stand locations.
Do not rely on background JavaScript timers for mobile delivery.

## Test gates
1. Native login and deep-link callbacks (password reset, email link).
2. County map, home live statistics, report posting and freshness on iOS and Android.
3. Field Talk content moderation, photos, deletion and blocking.
4. Real push delivery on physical devices, opt-in/out, unsubscribe and paid-state gating.
5. Subscription purchase, restoration, renewal, failure, cancel, cross-platform entitlements.
6. Accessibility, privacy labels, store review accounts and anti-spam protections.

Do not put the private Field Talk beta password or test API keys in native builds.
Do not push an app to production without explicit owner approval.
