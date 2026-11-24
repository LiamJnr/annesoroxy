import { createPaymentIntent } from "./payment-api.js?v=20261124-2";
import { createStripeClient, loadStripe } from "./stripe-loader.js?v=20261124-2";

export function createCheckoutController({ ui, appearance }) {
  let activeCheckout;
  let mountedPaymentElement;
  let attempt = 0;
  let isPreparing = false;
  let isSubmitting = false;

  function clearMountedCheckout() {
    mountedPaymentElement?.unmount();
    mountedPaymentElement = undefined;
    activeCheckout = undefined;
    ui.hideForm();
    ui.paymentElementTarget.replaceChildren();
  }

  async function select(paymentType, label, options = {}) {
    if (isPreparing) return;

    const currentAttempt = ++attempt;
    isPreparing = true;
    ui.setPanelTitle(label);
    ui.openPanel();
    clearMountedCheckout();
    ui.setStatus("Preparing secure checkout…");
    ui.setAvailability("Preparing your selected checkout.");

    try {
      const checkout = await createPaymentIntent(paymentType, options);
      const Stripe = await loadStripe();
      if (currentAttempt !== attempt) return;

      const stripe = createStripeClient(Stripe, checkout.publishableKey, checkout.stripeAccount);
      const elements = stripe.elements({ clientSecret: checkout.clientSecret, appearance });
      const paymentElement = elements.create("payment");
      paymentElement.mount(ui.paymentElementTarget);

      if (currentAttempt !== attempt) {
        paymentElement.unmount();
        return;
      }

      mountedPaymentElement = paymentElement;
      activeCheckout = { stripe, elements, reservationId: checkout.reservationId };
      ui.showForm();
      ui.setStatus("Secure checkout is ready.");
      ui.setAvailability("Secure checkout is ready below.");
    } catch (error) {
      if (currentAttempt !== attempt) return;
      ui.setStatus(error.message || "Checkout could not be prepared.", true);
      ui.setAvailability("This payment option is unavailable right now.");
    } finally {
      if (currentAttempt === attempt) isPreparing = false;
    }
  }

  function close() {
    attempt += 1;
    isPreparing = false;
    isSubmitting = false;
    clearMountedCheckout();
    ui.closePanel();
    ui.setAvailability("Checkout opens only when you choose.");
  }

  async function submit() {
    if (!activeCheckout || isSubmitting) return;

    isSubmitting = true;
    ui.setSubmitting(true);
    ui.setStatus("Submitting secure payment…");

    try {
      const validation = await activeCheckout.elements.submit();
      if (validation.error) {
        ui.setStatus(validation.error.message || "Please review your payment details.", true);
        return;
      }

      const confirmationUrl = new URL("/payment-confirmed/", window.location.origin);
      confirmationUrl.searchParams.set("reservation_id", activeCheckout.reservationId);

      const result = await activeCheckout.stripe.confirmPayment({
        elements: activeCheckout.elements,
        confirmParams: { return_url: confirmationUrl.toString() },
        redirect: "if_required",
      });

      if (result.error) {
        ui.setStatus(result.error.message || "Payment could not be submitted.", true);
        return;
      }

      window.location.assign(confirmationUrl.toString());
    } catch {
      ui.setStatus("Payment could not be submitted. Please try again.", true);
    } finally {
      isSubmitting = false;
      ui.setSubmitting(false);
    }
  }

  return { close, select, submit };
}
