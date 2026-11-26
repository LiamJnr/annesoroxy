const HANDYPAY_PAYMENT_INTENTS_URL = "https://api.handypay.me/api/v1/payment-intents";
const VALID_PAYMENT_TYPES = new Set(["custom", "tip"]);
const CUSTOM_CONTENT_BASE_AMOUNT_CENTS = 500;

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

  const isPriority = paymentType === "custom" && payload?.priority === true;
  const includesPremadeAccess = paymentType === "custom" && payload?.premadeAccess === true;
  let finalAmount = offering.amount_cents;
  let finalLabel = offering.label;

  if (paymentType === "tip") {
    const parsedTip = Number(payload?.amount);
    if (
      Number.isSafeInteger(parsedTip) &&
      parsedTip % 100 === 0 &&
      parsedTip >= 500 &&
      parsedTip <= 100000
    ) {
      finalAmount = parsedTip;
      finalLabel = `Supporter tip ($${finalAmount / 100})`;
    } else {
      return json({ error: "Invalid tip amount. Please enter a whole-dollar amount between $5 and $1,000." }, 400);
    }
  } else if (paymentType === "custom") {
    // The public interface advertises a $5 baseline. Fail closed if D1 is
    // changed without also updating that approved public price.
    if (offering.amount_cents !== CUSTOM_CONTENT_BASE_AMOUNT_CENTS) {
      return json({ error: "Custom-content pricing is not configured correctly." }, 503);
    }

    finalAmount = CUSTOM_CONTENT_BASE_AMOUNT_CENTS;
    finalAmount += (isPriority ? 1699 : 0) + (includesPremadeAccess ? 1000 : 0);
    const addOns = [isPriority && "Priority push", includesPremadeAccess && "Pre-made access"].filter(Boolean);
    if (addOns.length) finalLabel = `${offering.label} (${addOns.join(" + ")})`;
  }

  // Only consume a checkout allocation after the requested amount has passed
  // validation. This matters for providers that allocate checkout capacity when
  // an embedded form is created rather than when the payment succeeds.
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

  const reservationId = crypto.randomUUID();
  const createdAt = Date.now();

  await env.PAYMENTS_DB.prepare(
    `INSERT INTO checkout_reservations
      (id, payment_type, amount_cents, currency, priority, premade_access, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(reservationId, offering.payment_type, finalAmount, offering.currency, Number(isPriority), Number(includesPremadeAccess), createdAt)
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
        amount: finalAmount,
        currency: offering.currency,
        description: finalLabel,
        metadata: {
          reservation_id: reservationId,
          payment_type: offering.payment_type,
          priority: String(isPriority),
          premade_access: String(includesPremadeAccess),
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
  if (typeof intent.payment_intent_id !== "string") {
    await env.PAYMENTS_DB.prepare(
      "UPDATE checkout_reservations SET status = 'creation_failed' WHERE id = ?",
    )
      .bind(reservationId)
      .run();
    return json({ error: "Unable to start secure checkout. Please try again." }, 502);
  }

  await env.PAYMENTS_DB.prepare(
    `UPDATE checkout_reservations
        SET handypay_intent_id = ?, status = 'checkout_ready'
      WHERE id = ?`,
  )
    .bind(intent.payment_intent_id, reservationId)
    .run();

  // HandyPay documents these as the only browser-safe fields for embedded checkout.
  return json({
    reservationId,
    clientSecret: intent.client_secret,
    publishableKey: intent.publishable_key,
    stripeAccount: intent.stripe_account,
  });
}
