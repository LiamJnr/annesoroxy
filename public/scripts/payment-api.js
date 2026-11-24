export async function createPaymentIntent(paymentType) {
  const response = await fetch("/api/payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentType }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { error: `Checkout service returned HTTP ${response.status}.` };

  if (!response.ok) {
    throw new Error(payload.error || "Checkout is unavailable.");
  }

  return payload;
}
