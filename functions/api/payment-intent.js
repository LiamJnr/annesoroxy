const HANDYPAY_PAYMENT_INTENTS_URL = "https://api.handypay.me/api/v1/payment-intents";
const VALID_PAYMENT_TYPES = new Set(["custom", "premade", "tip"]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: { Allow: "OPTIONS, POST" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.PAYMENTS_DB || !env.HANDYPAY_API_KEY) {
    return json({ error: "Payments are not configured yet." }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "A JSON payment selection is required." }, 400);
  }

  const paymentType = payload?.paymentType;
  if (!VALID_PAYMENT_TYPES.has(paymentType)) {
    return json({ error: "That payment option is unavailable." }, 400);
  }

  // Price, currency, and allocation are intentionally read only from D1.
  // Never accept an amount or currency from the browser.
  const claim = await env.PAYMENTS_DB.prepare(
    `UPDATE payment_offerings
       SET checkout_used = checkout_used + 1
     WHERE payment_type = ?
       AND active = 1
       AND checkout_used < checkout_limit`,
  )
    .bind(paymentType)
    .run();

  if (claim.meta.changes !== 1) {
    return json(
      { error: "This payment option is not available right now.", code: "allocation_unavailable" },
      409,
    );
  }

  const offering = await env.PAYMENTS_DB.prepare(
    `SELECT payment_type, label, amount_cents, currency
       FROM payment_offerings
      WHERE payment_type = ?`,
  )
    .bind(paymentType)
    .first();

  if (!offering) {
    return json({ error: "This payment option is not configured." }, 503);
  }

  const reservationId = crypto.randomUUID();
  const createdAt = Date.now();

  await env.PAYMENTS_DB.prepare(
    `INSERT INTO checkout_reservations
      (id, payment_type, amount_cents, currency, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(reservationId, offering.payment_type, offering.amount_cents, offering.currency, createdAt)
    .run();

  let handypayResponse;
  try {
    handypayResponse = await fetch(HANDYPAY_PAYMENT_INTENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HANDYPAY_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": reservationId,
      },
      body: JSON.stringify({
        amount: offering.amount_cents,
        currency: offering.currency,
        description: offering.label,
        metadata: {
          reservation_id: reservationId,
          payment_type: offering.payment_type,
        },
      }),
    });
  } catch {
    await env.PAYMENTS_DB.prepare(
      "UPDATE checkout_reservations SET status = 'creation_failed' WHERE id = ?",
    )
      .bind(reservationId)
      .run();
    return json({ error: "Unable to start secure checkout. Please try again." }, 502);
  }

  const handypayPayload = await handypayResponse.json().catch(() => null);
  if (!handypayResponse.ok || !handypayPayload?.success || !handypayPayload?.data) {
    await env.PAYMENTS_DB.prepare(
      "UPDATE checkout_reservations SET status = 'creation_failed' WHERE id = ?",
    )
      .bind(reservationId)
      .run();
    return json({ error: "Unable to start secure checkout. Please try again." }, 502);
  }

  const intent = handypayPayload.data;
  await env.PAYMENTS_DB.prepare(
    `UPDATE checkout_reservations
        SET handypay_intent_id = ?, status = 'checkout_ready'
      WHERE id = ?`,
  )
    .bind(intent.id, reservationId)
    .run();

  // HandyPay documents these as the only browser-safe fields for embedded checkout.
  return json({
    reservationId,
    clientSecret: intent.client_secret,
    publishableKey: intent.publishable_key,
    stripeAccount: intent.stripe_account,
  });
}
