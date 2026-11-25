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
    "SELECT status, premade_access FROM checkout_reservations WHERE id = ?",
  )
    .bind(reservationId)
    .first();

  if (!reservation) {
    return json({ error: "Payment reference not found." }, 404);
  }

  return json({
    status: reservation.status,
    premadeAccess: reservation.status === "paid" && reservation.premade_access === 1,
  });
}
