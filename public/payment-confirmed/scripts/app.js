import { fetchPaymentStatus } from "./payment-status.js";

const title = document.querySelector("#confirmation-title");
const message = document.querySelector("#confirmation-message");
const homeLink = document.querySelector("#home-link");
const reservationId = new URLSearchParams(window.location.search).get("reservation_id");
const maximumChecks = 45;
let checks = 0;

function showFinal(heading, detail) {
  title.textContent = heading;
  message.textContent = detail;
  homeLink.hidden = false;
}

async function checkPaymentStatus() {
  if (!reservationId) {
    showFinal("We need a payment reference.", "Return home and begin checkout again.");
    return;
  }

  try {
    const paymentStatus = await fetchPaymentStatus(reservationId);

    if (paymentStatus === "paid") {
      showFinal("You’re all set.", "Your payment was securely confirmed. Thank you.");
      return;
    }

    if (paymentStatus === "failed") {
      showFinal("Your payment wasn’t completed.", "No confirmed payment was received. You can try again whenever you’re ready.");
      return;
    }

    checks += 1;
    if (checks >= maximumChecks) {
      showFinal("We’re still confirming it.", "Your payment may still complete shortly. Please check back in a moment.");
      return;
    }

    window.setTimeout(checkPaymentStatus, 2000);
  } catch (error) {
    checks += 1;
    if (checks >= maximumChecks || error.message === "Payment reference not found.") {
      showFinal("Confirmation is temporarily unavailable.", "Please check back shortly.");
      return;
    }
    window.setTimeout(checkPaymentStatus, 2000);
  }
}

checkPaymentStatus();
