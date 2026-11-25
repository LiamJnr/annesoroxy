const MAX_DESCRIPTION_LENGTH = 180;
const MAX_AMOUNT_CENTS = 1_000_000;

function json(body, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function mapRequest(row) { return { id: row.id, token: row.token, description: row.description, amountCents: row.amount_cents, currency: row.currency, status: row.status, createdAt: row.created_at, expiresAt: row.expires_at, paidAt: row.paid_at }; }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), (n) => n.toString(16).padStart(2, "0")).join(""); }

function parse(payload) {
  const description = typeof payload?.description === "string" ? payload.description.trim() : "";
  const amountCents = Number(payload?.amountCents);
  const expiresAt = payload?.expiresAt ? Number(payload.expiresAt) : null;
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) throw new Error(`Enter a description up to ${MAX_DESCRIPTION_LENGTH} characters.`);
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) throw new Error("Enter a valid amount.");
  if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())) throw new Error("Choose an expiry date in the future, or leave it blank.");
  return { description, amountCents, expiresAt };
}

export async function onRequestGet({ env }) {
  if (!env.PAYMENTS_DB) return json({ error: "Payments are not configured yet." }, 503);
  const { results } = await env.PAYMENTS_DB.prepare(`SELECT id, token, description, amount_cents, currency, status, created_at, expires_at, paid_at FROM payment_requests ORDER BY created_at DESC LIMIT 30`).all();
  return json({ requests: results.map(mapRequest) });
}

export async function onRequestPost({ request, env }) {
  if (!env.PAYMENTS_DB) return json({ error: "Payments are not configured yet." }, 503);
  let data;
  try { data = parse(await request.json()); } catch (error) { return json({ error: error.message || "A JSON request is required." }, 400); }
  const id = crypto.randomUUID();
  const privateToken = token();
  const createdAt = Date.now();
  await env.PAYMENTS_DB.prepare(`INSERT INTO payment_requests (id, token, description, amount_cents, currency, status, created_at, expires_at) VALUES (?, ?, ?, ?, 'usd', 'open', ?, ?)`)
    .bind(id, privateToken, data.description, data.amountCents, createdAt, data.expiresAt).run();
  return json({ request: { id, token: privateToken, description: data.description, amountCents: data.amountCents, currency: "usd", status: "open", createdAt, expiresAt: data.expiresAt, paidAt: null } }, 201);
}
