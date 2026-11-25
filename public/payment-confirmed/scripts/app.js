import { fetchPaymentStatus } from "./payment-status.js?v=20261124-2";

const title = document.querySelector("#confirmation-title");
const message = document.querySelector("#confirmation-message");
const homeLink = document.querySelector("#home-link");
const receiptPanel = document.querySelector("#receipt-panel");
const receiptButton = document.querySelector("#receipt-download");
const reservationId = new URLSearchParams(window.location.search).get("reservation_id");
const maximumChecks = 45;
let checks = 0;

function showFinal(heading, detail) {
  title.textContent = heading;
  message.textContent = detail;
  homeLink.hidden = false;
}

function showReceiptDownload() {
  if (!receiptPanel || !receiptButton || !reservationId) return;
  receiptPanel.hidden = false;
  receiptButton.href = `/api/premade-access-receipt?reservation_id=${encodeURIComponent(reservationId)}`;
}

if (receiptButton) {
  receiptButton.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!receiptButton.href || receiptButton.dataset.downloading === "true") return;

    receiptButton.dataset.downloading = "true";
    try {
      const response = await fetch(receiptButton.href, { cache: "no-store" });
      if (!response.ok) throw new Error("Receipt unavailable.");

      const receiptBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(receiptBlob);
      const download = document.createElement("a");
      download.href = downloadUrl;
      download.download = `roxy-premade-access-${reservationId}.txt`;
      download.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      message.textContent = "Your receipt is temporarily unavailable. Please try again shortly.";
    } finally {
      delete receiptButton.dataset.downloading;
    }
  });
}

async function checkPaymentStatus() {
  if (!reservationId) {
    showFinal("We need a payment reference.", "Return home and begin checkout again.");
    return;
  }

  try {
    const payment = await fetchPaymentStatus(reservationId);

    if (payment.status === "paid") {
      showFinal("You’re all set.", "Your payment was securely confirmed. Thank you.");
      if (payment.premadeAccess) showReceiptDownload();
      return;
    }

    if (payment.status === "failed") {
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
