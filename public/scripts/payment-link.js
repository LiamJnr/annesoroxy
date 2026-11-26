const token = window.ROXY_PAYMENT_TOKEN;
const title = document.querySelector("#title");
const detail = document.querySelector("#detail");
const summary = document.querySelector("#summary");
const amount = document.querySelector("#amount");
const confirmAmount = document.querySelector("#confirm-amount");
const checkout = document.querySelector("#checkout");
const checkoutStatus = document.querySelector("#checkout-status");
const form = document.querySelector("#payment-form");
const submit = document.querySelector("#submit");
let active;

const endpoint = `/api/payment-request/${encodeURIComponent(token)}`;
const currency = (cents, code) => new Intl.NumberFormat("en-US", { style: "currency", currency: code.toUpperCase() }).format(cents / 100);
function final(heading, text) { title.textContent = heading; detail.textContent = text; }
function loadStripe() { if (window.Stripe) return Promise.resolve(window.Stripe); return new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://js.stripe.com/v3/"; script.onload = () => resolve(window.Stripe); script.onerror = () => reject(new Error("Secure checkout could not load.")); document.head.append(script); }); }

async function prepareCheckout() {
  confirmAmount.disabled = true;
  confirmAmount.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Getting things ready…</span>';
  checkout.hidden = false;
  checkoutStatus.textContent = "Getting things ready for you…";
  try {
    const response = await fetch(endpoint, { method: "POST" });
    const intent = await response.json();
    if (!response.ok) throw new Error(intent.error);
    const Stripe = await loadStripe();
    const stripe = intent.stripeAccount ? Stripe(intent.publishableKey, { stripeAccount: intent.stripeAccount }) : Stripe(intent.publishableKey);
    const elements = stripe.elements({ clientSecret: intent.clientSecret, appearance: { theme: "flat", variables: { colorPrimary: "#351476", colorBackground: "#f4f0e8", colorText: "#10100f", borderRadius: "0px", fontFamily: "DM Mono, monospace" } } });
    elements.create("payment").mount("#payment-element");
    active = { stripe, elements };
    checkoutStatus.remove();
    form.hidden = false;
    confirmAmount.hidden = true;
  } catch (error) {
    checkout.hidden = true;
    detail.textContent = error.message || "Aww, checkout could not be prepared. Please try again.";
    confirmAmount.disabled = false;
    confirmAmount.textContent = "Lock In This Request";
  }
}

async function start() {
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    const request = payload.request;
    if (request.status === "paid") return final("Already taken care of.", "This request has already been paid for. Check in with me on Snapchat!");
    if (!["open", "checkout_ready", "failed"].includes(request.status)) return final("This link has expired.", "This private link is no longer active. Message me on Snapchat if you need a new one.");
    title.textContent = request.description;
    detail.textContent = "This is our private arrangement. When you're ready, confirm below so I can get started on this for you.";
    amount.textContent = currency(request.amountCents, request.currency);
    summary.hidden = false;
    confirmAmount.hidden = false;
  } catch (error) {
    final("This link has expired.", error.message || "This private link is no longer active. Message me on Snapchat if you need a new one.");
  }
}

confirmAmount.addEventListener("click", prepareCheckout);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!active) return;
  submit.disabled = true;
  submit.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Any moment from now…</span>';
  try {
    const validation = await active.elements.submit();
    if (validation.error) throw validation.error;
    const returnUrl = `${location.origin}/payment-confirmed/?payment_request=${encodeURIComponent(token)}`;
    const result = await active.stripe.confirmPayment({ elements: active.elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (result.error) throw result.error;
    location.assign(returnUrl);
  } catch (error) {
    detail.textContent = error.message || "Aww, your payment didn’t go through. Double-check your card details and try again.";
  } finally {
    submit.disabled = false;
    submit.textContent = "Lock In My Request";
  }
});

start();
