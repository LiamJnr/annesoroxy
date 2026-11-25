const reservationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textReceipt(reservation) {
  const paidAt = new Date(reservation.paid_at).toISOString().replace("T", " ").replace(".000Z", " UTC");
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: reservation.currency.toUpperCase(),
  }).format(reservation.amount_cents / 100);

  return [
    "ROXY / PRE-MADE ACCESS RECEIPT",
    "",
    `Receipt reference: ${reservation.id}`,
    `Payment confirmed: ${paidAt}`,
    `Amount paid: ${amount}`,
    "Pre-made access: Included",
    "",
    "Send this receipt to Snapchat @annesoroxy for confirmation.",
  ].join("\n");
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
    `SELECT id, amount_cents, currency, paid_at
       FROM checkout_reservations
      WHERE id = ? AND status = 'paid' AND premade_access = 1`,
  )
    .bind(reservationId)
    .first();

  if (!reservation) {
    return Response.json({ error: "A pre-made access receipt is not available for this payment." }, { status: 404 });
  }

  const filename = `roxy-premade-access-${reservation.id}.txt`;
  return new Response(textReceipt(reservation), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/plain; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
