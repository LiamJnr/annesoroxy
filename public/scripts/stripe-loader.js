let stripeLoader;

export function loadStripe() {
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

export function createStripeClient(Stripe, publishableKey, stripeAccount) {
  if (!publishableKey) throw new Error("Checkout is missing its public configuration.");
  return stripeAccount ? Stripe(publishableKey, { stripeAccount }) : Stripe(publishableKey);
}
