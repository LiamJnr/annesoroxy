// Checkout fields are loaded only after a visitor makes an explicit payment selection.
// The HandyPay secret key remains inside the Cloudflare Pages Function.
const paymentOptions = {
  custom: "Something custom",
  premade: "What’s ready",
  tip: "A little something",
};

const checkoutPanel = document.querySelector("#checkout-panel");
const checkoutTitle = document.querySelector("#checkout-title");
const closeButton = document.querySelector(".checkout-panel__close");
const availability = document.querySelector(".availability");
const checkoutStatus = document.querySelector(".checkout-status");
const checkoutForm = document.querySelector("#checkout-form");
const paymentElementTarget = document.querySelector("#payment-element");
const checkoutSubmit = document.querySelector(".checkout-submit");

let mountedPaymentElement;
let activeCheckout;
let stripeLoader;
let checkoutAttempt = 0;

function setStatus(message, isError = false) {
  checkoutStatus.textContent = message;
  checkoutStatus.classList.toggle("is-error", isError);
}

function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeLoader) return stripeLoader;

  stripeLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => resolve(window.Stripe);
    script.onerror = () => reject(new Error("Stripe.js could not load."));
    document.head.append(script);
  });
  return stripeLoader;
}

function clearMountedCheckout() {
  mountedPaymentElement?.unmount();
  mountedPaymentElement = undefined;
  activeCheckout = undefined;
  checkoutForm.hidden = true;
  paymentElementTarget.replaceChildren();
}

function closeCheckout() {
  checkoutAttempt += 1;
  clearMountedCheckout();
  checkoutPanel.classList.remove("is-open");
  checkoutPanel.setAttribute("aria-hidden", "true");
  availability.innerHTML = "<span></span> Checkout opens only when you choose.";
}

document.querySelectorAll("[data-payment-type]").forEach((button) => {
  button.addEventListener("click", async () => {
    const attempt = ++checkoutAttempt;
    const type = button.dataset.paymentType;
    checkoutTitle.textContent = paymentOptions[type];
    checkoutPanel.classList.add("is-open");
    checkoutPanel.setAttribute("aria-hidden", "false");
    clearMountedCheckout();
    setStatus("Preparing secure checkout…");
    availability.innerHTML = "<span></span> Preparing your selected checkout.";

    try {
      const response = await fetch("/api/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType: type }),
      });
      const checkout = await response.json();

      if (!response.ok) throw new Error(checkout.error || "Checkout is unavailable.");

      const Stripe = await loadStripeJs();
      if (attempt !== checkoutAttempt) return;
      const stripe = Stripe(checkout.publishableKey, { stripeAccount: checkout.stripeAccount });
      const elements = stripe.elements({
        clientSecret: checkout.clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#351476",
            colorBackground: "#f4f0e8",
            colorText: "#10100f",
            borderRadius: "0px",
            fontFamily: "DM Mono, monospace",
          },
        },
      });

      mountedPaymentElement = elements.create("payment");
      mountedPaymentElement.mount(paymentElementTarget);
      if (attempt !== checkoutAttempt) {
        mountedPaymentElement.unmount();
        mountedPaymentElement = undefined;
        return;
      }
      activeCheckout = { stripe, elements, reservationId: checkout.reservationId };
      checkoutForm.hidden = false;
      setStatus("Secure checkout is ready.");
      availability.innerHTML = "<span></span> Secure checkout is ready below.";
    } catch (error) {
      if (attempt !== checkoutAttempt) return;
      setStatus(error.message || "Checkout could not be prepared.", true);
      availability.innerHTML = "<span></span> This payment option is unavailable right now.";
    }
  });
});

closeButton.addEventListener("click", closeCheckout);

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();

  // Payment submission and redirect are intentionally deferred until the webhook-backed
  // confirmation page is added. A browser result must not be treated as payment success.
  if (activeCheckout) {
    setStatus("Final payment confirmation will be enabled with server verification.");
    checkoutSubmit.blur();
  }
});
