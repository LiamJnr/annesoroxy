# Payment function setup

This project includes `POST /api/payment-intent` as a Cloudflare Pages Function.

## Before deployment

1. Create a Cloudflare D1 database and run `schema.sql` against it.
2. Add the three approved offerings to `payment_offerings`. Prices are stored in the smallest currency unit; for example, `5000` USD cents is US$50. Do not accept price or currency from the browser.
3. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, then replace the placeholder database ID. If Cloudflare Pages is already configured in the dashboard, instead add a D1 binding named `PAYMENTS_DB` there and do not add a Wrangler config until you have imported the existing configuration.
4. In Cloudflare Pages > Settings > Variables and Secrets, add `HANDYPAY_API_KEY` as an encrypted secret for both Preview and Production. Never place it in a client-side file.
5. Keep each payment type inactive until its price, currency, and checkout limit are confirmed. Set `active = 1` only when it should create checkout sessions.

## Allocation behavior

Each successful request to the endpoint increments `checkout_used` for its payment type before the PaymentIntent is created. It is intentionally **not** refunded when a shopper abandons the checkout form. A failed request to HandyPay is logged as `creation_failed`, but the allocation stays consumed only after the form's checkout allocation is claimed; this matches the stated allocation policy.

The next client-side integration will call this endpoint only after the visitor selects an option, then use the returned `clientSecret`, `publishableKey`, and `stripeAccount` to mount the embedded checkout fields.

## Webhook confirmation

After deploying, register `https://annesoroxy.com/api/handypay-webhook` with HandyPay for `payment_intent.succeeded` and `payment_intent.payment_failed`. Store the one-time signing secret as the encrypted Pages secret `HANDYPAY_WEBHOOK_SECRET`.

Run `migrations/0001_handypay_webhook_events.sql` against the existing D1 database before deploying the webhook function. The `/payment-confirmed/` page polls a safe status endpoint and shows payment success only after a valid signed webhook records the reservation as `paid`.
