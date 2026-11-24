const encoder = new TextEncoder();

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function signatureBytes(header) {
  const prefix = "sha256=";
  if (!header.startsWith(prefix)) return null;

  const hex = header.slice(prefix.length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;

  return Uint8Array.from(hex.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
}

function equalInConstantTime(left, right) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function hasValidSignature(rawBody, header, secret) {
  const received = signatureBytes(header);
  if (!received) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  return equalInConstantTime(expected, received);
}

export async function onRequestPost({ request, env }) {
  if (!env.PAYMENTS_DB || !env.HANDYPAY_WEBHOOK_SECRET) {
    return json({ error: "Webhook is not configured." }, 503);
  }

  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get("x-handypay-signature") ?? "";
  if (!(await hasValidSignature(rawBody, signature, env.HANDYPAY_WEBHOOK_SECRET))) {
    return json({ error: "Invalid signature." }, 401);
  }

  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (typeof event?.id !== "string" || typeof event?.type !== "string") {
    return json({ error: "Invalid webhook event." }, 400);
  }

  const intentId = event?.data?.id;
  const receivedAt = Date.now();
  const statements = [
    env.PAYMENTS_DB.prepare(
      `INSERT OR IGNORE INTO handypay_webhook_events (id, event_type, received_at)
       VALUES (?, ?, ?)`,
    ).bind(event.id, event.type, receivedAt),
  ];

  if (event.type === "payment_intent.succeeded" && typeof intentId === "string") {
    statements.push(
      env.PAYMENTS_DB.prepare(
        `UPDATE checkout_reservations
            SET status = 'paid', paid_at = COALESCE(paid_at, ?)
          WHERE handypay_intent_id = ?`,
      ).bind(receivedAt, intentId),
    );
  }

  if (event.type === "payment_intent.payment_failed" && typeof intentId === "string") {
    statements.push(
      env.PAYMENTS_DB.prepare(
        `UPDATE checkout_reservations
            SET status = 'failed'
          WHERE handypay_intent_id = ?
            AND status IN ('pending', 'checkout_ready')`,
      ).bind(intentId),
    );
  }

  await env.PAYMENTS_DB.batch(statements);
  return json({ received: true });
}
