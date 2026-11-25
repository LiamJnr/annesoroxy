const reservationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function htmlReceipt(reservation) {
  const paidAt = new Date(reservation.paid_at || Date.now()).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (reservation.currency || "USD").toUpperCase(),
  }).format((reservation.amount_cents || 0) / 100);
  const isPriority = reservation.priority === 1;
  const isPremade = reservation.premade_access === 1;
  const itemTitle = reservation.payment_type === "premade" ? "Pre-made Content" : "Custom Content Request";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Roxy — Receipt ${reservation.id.slice(0, 8)}</title>
<style>
body{margin:0;padding:2rem 1rem;background:#faf8f5;color:#10100f;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;display:grid;place-items:center;min-height:100vh}
.card{width:min(34rem,100%);background:#fff;border:1px solid #351476;padding:2rem;border-radius:6px;display:flex;flex-direction:column;gap:1.2rem}
.header{display:flex;justify-content:space-between;align-items:flex-start}
.brand{margin:0;font-size:0.75rem;font-weight:600;letter-spacing:0.12em;color:#351476}
.site{margin:0.2rem 0 0;font-size:0.6rem;color:#777;letter-spacing:0.08em}
.badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.65rem;border:1px solid #351476;border-radius:999px;font-size:0.6rem;font-weight:600;color:#351476;background:#f3eefc}
.dot{width:6px;height:6px;background:#1cb866;border-radius:50%}
.divider{height:1px;background:repeating-linear-gradient(90deg,#ccc,#ccc 4px,transparent 4px,transparent 8px);border:0}
.grid{display:grid;gap:0.75rem}
.row{display:flex;justify-content:space-between;font-size:0.75rem}
.label{color:#666;font-size:0.68rem;text-transform:uppercase}
.value{font-weight:500;text-align:right}
.amount{color:#351476;font-size:1.1rem;font-weight:700}
.meta{display:grid;gap:0.5rem;padding:0.9rem;background:#fbf9f6;border:1px solid #e5ded5;border-radius:4px;font-size:0.68rem}
.meta-item{display:flex;justify-content:space-between;gap:0.8rem}
.meta-val{font-weight:600;color:#351476;word-break:break-all}
.barcode{width:100%;height:1.5rem;background:repeating-linear-gradient(90deg,#351476 0,#351476 2px,transparent 2px,transparent 4px,#351476 4px,#351476 7px,transparent 7px,transparent 10px,#351476 10px,#351476 11px,transparent 11px,transparent 14px,#351476 14px,#351476 18px,transparent 18px,transparent 20px);opacity:0.75}
.snapchat{padding:1rem;background:#f3eefc;border:1px solid #351476;border-radius:4px;font-size:0.72rem;line-height:1.5}
.fineprint{margin:0;font-size:0.55rem;color:#888;text-align:center;letter-spacing:0.06em}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div>
      <p class="brand">ROXY / OFFICIAL TRANSACTION VOUCHER</p>
      <p class="site">ANNESOROXY.COM</p>
    </div>
    <div class="badge"><span class="dot"></span>VERIFIED PAYMENT</div>
  </div>
  <div class="divider"></div>
  <div class="grid">
    <div class="row"><span class="label">Item</span><span class="value">${itemTitle}</span></div>
    <div class="row"><span class="label">Priority Queue</span><span class="value">${isPriority ? "Included (Top Priority)" : "Standard Queue"}</span></div>
    <div class="row"><span class="label">Pre-made Access</span><span class="value">${isPremade ? "Included (Instant Access)" : "Standard"}</span></div>
    <div class="row"><span class="label">Total Paid</span><span class="value amount">${amount}</span></div>
  </div>
  <div class="divider"></div>
  <div class="meta">
    <div class="meta-item"><span class="label">Reference ID</span><span class="meta-val">${reservation.id}</span></div>
    <div class="meta-item"><span class="label">Timestamp</span><span class="meta-val">${paidAt}</span></div>
  </div>
  <div class="snapchat">
    <strong>SNAPCHAT VERIFICATION:</strong> Send this receipt to Snapchat <strong>@annesoroxy</strong> for immediate confirmation.
  </div>
  <div class="barcode"></div>
  <p class="fineprint">PAYMENT CONFIRMATION RECEIPT · ANNESOROXY.COM</p>
</div>
</body>
</html>`;
}

export async function onRequestGet({ request, env }) {
  if (!env.PAYMENTS_DB) {
    return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
  }

  const reservationId = new URL(request.url).searchParams.get("reservation_id") ?? "";
  if (!reservationIdPattern.test(reservationId)) {
    return Response.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  const reservation = await env.PAYMENTS_DB.prepare(
    `SELECT id, payment_type, amount_cents, currency, priority, premade_access, paid_at
       FROM checkout_reservations
      WHERE id = ? AND status = 'paid'`,
  )
    .bind(reservationId)
    .first();

  if (!reservation) {
    return Response.json({ error: "A receipt is not available for this payment." }, { status: 404 });
  }

  const filename = `roxy-receipt-${reservation.id}.html`;
  return new Response(htmlReceipt(reservation), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/html; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
