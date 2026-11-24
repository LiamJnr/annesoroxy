import { createCheckoutController } from "./checkout-controller.js";
import { paymentOptions, stripeAppearance } from "./config.js";
import { createCheckoutUi } from "./checkout-ui.js";

const ui = createCheckoutUi();
const checkout = createCheckoutController({ ui, appearance: stripeAppearance });

document.querySelectorAll("[data-payment-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const paymentType = button.dataset.paymentType;
    checkout.select(paymentType, paymentOptions[paymentType]);
  });
});

ui.closeButton.addEventListener("click", () => checkout.close());
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  checkout.submit();
});
