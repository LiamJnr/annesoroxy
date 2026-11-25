export async function fetchPaymentStatus(reservationId) {
  const response = await fetch(`/api/payment-status?reservation_id=${encodeURIComponent(reservationId)}`, {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Payment reference not found.");
  }

  return payload;
}
