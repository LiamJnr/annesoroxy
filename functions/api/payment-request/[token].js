const TOKEN = /^[a-f0-9]{48}$/i;
const HANDYPAY_URL = "https://api.handypay.me/api/v1/payment-intents";

function json(body, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function expired(request) { return request.expires_at !== null && request.expires_at <= Date.now(); }
function publicRequest(request) { return { description: request.description, amountCents: request.amount_cents, currency: request.currency, status: expired(request) && request.status === "open" ? "expired" : request.status, expiresAt: request.expires_at }; }

async function findRequest(env, token) {
  return env.PAYMENTS_DB.prepare(`SELECT id, token, description, amount_cents, currency, status, expires_at, handypay_intent_id, client_secret, publishable_key, stripe_account FROM payment_requests WHERE token = ?`).bind(token).first();
}

export async function onRequestGet({ params, env }) {
  if (!env.PAYMENTS_DB) return json({ error: "Payments are not configured yet." }, 503);
  const token = params.token ?? "";
  if (!TOKEN.test(token)) return json({ error: "Payment link not found." }, 404);
  const request = await findRequest(env, token);
  if (!request) return json({ error: "Payment link not found." }, 404);
  return json({ request: publicRequest(request) });
}

export async function onRequestPost({ params, env }) {
  if (!env.PAYMENTS_DB || !env.HANDYPAY_API_KEY) return json({ error: "Payments are not configured yet." }, 503);
  const token = params.token ?? "";
  if (!TOKEN.test(token)) return json({ error: "Payment link not found." }, 404);
  const request = await findRequest(env, token);
  if (!request) return json({ error: "Payment link not found." }, 404);
  if (expired(request)) {
    await env.PAYMENTS_DB.prepare("UPDATE payment_requests SET status = 'expired' WHERE id = ? AND status = 'open'").bind(request.id).run();
    return json({ error: "This payment link has expired." }, 410);
  }
  if (request.status === "paid") return json({ error: "This request has already been paid." }, 409);
  if (request.status === "cancelled") return json({ error: "This payment link is no longer available." }, 410);
  if (request.status === "checkout_ready" && request.client_secret && request.publishable_key) {
    return json({ clientSecret: request.client_secret, publishableKey: request.publishable_key, stripeAccount: request.stripe_account });
  }

  const response = await fetch(HANDYPAY_URL, { method: "POST", headers: { Authorization: `Bearer ${env.HANDYPAY_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": request.id }, body: JSON.stringify({ amount: request.amount_cents, currency: request.currency, description: request.description, metadata: { payment_request_id: request.id } }) }).catch(() => null);
  const payload = response && await response.json().catch(() => null);
  const intent = payload?.data;
  if (!response?.ok || !payload?.success || !intent?.payment_intent_id || !intent?.client_secret || !intent?.publishable_key) return json({ error: "Unable to start checkout. Please try again." }, 502);

  await env.PAYMENTS_DB.prepare(`UPDATE payment_requests SET handypay_intent_id = ?, client_secret = ?, publishable_key = ?, stripe_account = ?, status = 'checkout_ready' WHERE id = ? AND status IN ('open', 'failed')`).bind(intent.payment_intent_id, intent.client_secret, intent.publishable_key, intent.stripe_account ?? null, request.id).run();
  return json({ clientSecret: intent.client_secret, publishableKey: intent.publishable_key, stripeAccount: intent.stripe_account ?? null });
}
