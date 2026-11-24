export function createCheckoutUi() {
  const panel = document.querySelector("#checkout-panel");
  const title = document.querySelector("#checkout-title");
  const closeButton = document.querySelector(".checkout-panel__close");
  const availability = document.querySelector(".availability");
  const status = document.querySelector(".checkout-status");
  const form = document.querySelector("#checkout-form");
  const paymentElementTarget = document.querySelector("#payment-element");
  const submitButton = document.querySelector(".checkout-submit");

  function setAvailability(message) {
    if (!availability) return;
    const dot = document.createElement("span");
    availability.replaceChildren(dot, document.createTextNode(` ${message}`));
  }

  return {
    closeButton,
    form,
    paymentElementTarget,
    setPanelTitle(value) { title.textContent = value; },
    openPanel() { panel.classList.add("is-open"); panel.setAttribute("aria-hidden", "false"); },
    closePanel() { panel.classList.remove("is-open"); panel.setAttribute("aria-hidden", "true"); },
    setStatus(message, isError = false) { status.textContent = message; status.classList.toggle("is-error", isError); },
    setAvailability,
    showForm() { form.hidden = false; },
    hideForm() { form.hidden = true; },
    setSubmitting(isSubmitting) { submitButton.disabled = isSubmitting; },
  };
}
