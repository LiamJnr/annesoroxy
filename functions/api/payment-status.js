const reservationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.PAYMENTS_DB) {
    return json({ error: "Payments are not configured yet." }, 503);
  }

  const reservationId = new URL(request.url).searchParams.get("reservation_id") ?? "";
  if (!reservationIdPattern.test(reservationId)) {
    return json({ error: "Invalid payment reference." }, 400);
  }

  const reservation = await env.PAYMENTS_DB.prepare(
    `SELECT id, status, payment_type, amount_cents, currency, priority, premade_access, paid_at
       FROM checkout_reservations
      WHERE id = ?`,
  )
    .bind(reservationId)
    .first();

  if (!reservation) {
    return json({ error: "Payment reference not found." }, 404);
  }

  return json({
    id: reservation.id,
    status: reservation.status,
    paymentType: reservation.payment_type,
    amountCents: reservation.amount_cents,
    currency: reservation.currency,
    priority: reservation.priority === 1,
    premadeAccess: reservation.premade_access === 1,
    paidAt: reservation.paid_at,
  });
}
