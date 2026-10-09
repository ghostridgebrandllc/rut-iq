# Rut IQ subscriptions — prepared, disabled

The isolated Rut IQ product and monthly $7.99 / annual $49.99 USD recurring prices exist in the existing Ghost Ridge Brand sandbox. All three are inactive. Exact IDs are in catalog.json. No live product, subscription, payment link, Checkout Session, webhook destination, or charge was created. Woods IQ was not changed.

Reporting remains free. Tester access is an administrative entitlement (`plan=pro`, `source=tester`, `status=active`), optionally expiring at `current_period_end`; it must not create Stripe customers or subscriptions.

## Required before enabling payment

1. Obtain explicit owner approval for a working paid checkout. Keep the frontend button disabled until the entire payment lifecycle is verified.
2. Use an isolated Rut IQ backend with a restricted Stripe key, server-side allowed product/price IDs, and server-verified Supabase identity. Never accept a client-supplied user ID, price amount, or entitlement.
3. Build hosted Checkout in subscription mode, quantity one, flexible billing. Tag both Session and Subscription `app=rut_iq`, plus the verified Rut IQ user ID. Use a namespaced integration identifier. Prevent duplicate active subscriptions.
4. Implement signed webhooks using the raw request body and a dedicated endpoint secret. Validate livemode, the Rut IQ product/price allowlist, app metadata and persisted user/customer association. Ignore all Woods IQ events. Store processed event IDs and retrieve current subscription state to withstand duplicate and out-of-order events.
5. Reconcile paid/active access after verified payment events; never grant Pro from the success URL. Use invoice.paid, invoice.payment_failed, customer.subscription.updated/deleted, checkout.session.completed and checkout.session.async_payment_succeeded with appropriate payment-state checks. Never overwrite tester entitlements. Fail closed when entitlement cannot be verified.
6. Use separate Rut IQ customer/subscription records and a dedicated billing portal configuration limited to Rut IQ prices. Cancellation keeps access only through the paid period; failed/unpaid/expired access follows the approved entitlement policy.
7. Verify taxes/registrations before enabling automatic tax. Test purchase, renewal, cancellation, payment failure, duplicate delivery, event reordering, cross-app rejection and entitlement expiry entirely in sandbox.
8. Only after owner approval, provision corresponding live resources and configure secrets in the backend environment. No secret belongs in index.html or this repository.

References: https://docs.stripe.com/billing/subscriptions/build-subscriptions and https://docs.stripe.com/webhooks
