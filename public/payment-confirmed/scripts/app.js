import { fetchPaymentStatus } from "./payment-status.js?v=20261124-5";

const title = document.querySelector("#confirmation-title");
const message = document.querySelector("#confirmation-message");
const mark = document.querySelector("#confirmation-mark");
const homeLink = document.querySelector("#home-link");
const snapchatPanel = document.querySelector("#snapchat-panel");
const receiptCard = document.querySelector("#receipt-card");
const receiptDownload = document.querySelector("#receipt-download");
const copyRefButton = document.querySelector("#copy-ref-button");

const receiptItem = document.querySelector("#receipt-item");
const receiptPriorityRow = document.querySelector("#receipt-priority-row");
const receiptPriority = document.querySelector("#receipt-priority");
const receiptPremadeRow = document.querySelector("#receipt-premade-row");
const receiptPremade = document.querySelector("#receipt-premade");
const receiptAmount = document.querySelector("#receipt-amount");
const receiptRef = document.querySelector("#receipt-ref");
const receiptTime = document.querySelector("#receipt-time");

const reservationId = new URLSearchParams(window.location.search).get("reservation_id");
const maximumChecks = 45;
let checks = 0;

function formatCurrency(cents, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
  }).format((cents || 0) / 100);
}

function formatDate(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function showFinal(heading, detail, isSuccess = false) {
  title.textContent = heading;
  message.textContent = detail;
  homeLink.hidden = false;
  if (!isSuccess && mark) {
    mark.textContent = "×";
    mark.style.background = "#8b1d3f";
  }
}

function renderReceipt(payment) {
  if (!receiptCard) return;

  const formattedTime = formatDate(payment.paidAt);
  const formattedAmount = formatCurrency(payment.amountCents, payment.currency);

  if (receiptItem) {
    receiptItem.textContent = payment.paymentType === "premade" ? "Pre-made Content" : "Custom Content Request";
  }

  if (receiptPriorityRow && receiptPriority) {
    receiptPriorityRow.hidden = !payment.priority;
    receiptPriority.textContent = payment.priority ? "Included (Top Priority)" : "Standard";
  }

  if (receiptPremadeRow && receiptPremade) {
    receiptPremadeRow.hidden = !payment.premadeAccess;
    receiptPremade.textContent = payment.premadeAccess ? "Included (Instant Access)" : "Standard";
  }

  if (receiptAmount) receiptAmount.textContent = formattedAmount;
  if (receiptRef) receiptRef.textContent = payment.id;
  if (receiptTime) receiptTime.textContent = formattedTime;

  receiptCard.hidden = false;
  if (snapchatPanel) snapchatPanel.hidden = false;

  if (receiptDownload) {
    receiptDownload.href = `/api/premade-access-receipt?reservation_id=${encodeURIComponent(payment.id)}`;
    receiptDownload.hidden = false;
  }
}

if (copyRefButton && reservationId) {
  copyRefButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(reservationId);
      const originalText = copyRefButton.textContent;
      copyRefButton.textContent = "Copied!";
      setTimeout(() => {
        copyRefButton.textContent = originalText;
      }, 2000);
    } catch {
      copyRefButton.textContent = "Reference: " + reservationId.slice(0, 8);
    }
  });
}

if (receiptDownload) {
  receiptDownload.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!receiptDownload.href || receiptDownload.dataset.downloading === "true") return;

    receiptDownload.dataset.downloading = "true";
    try {
      const response = await fetch(receiptDownload.href, { cache: "no-store" });
      if (!response.ok) throw new Error("Receipt unavailable.");

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = downloadUrl;
      download.download = `roxy-receipt-${reservationId}.html`;
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      message.textContent = "Your receipt is temporarily unavailable. Please screenshot the card above.";
    } finally {
      delete receiptDownload.dataset.downloading;
    }
  });
}

async function checkPaymentStatus() {
  if (!reservationId) {
    showFinal("Payment reference missing.", "Return home and begin checkout again.", false);
    return;
  }

  try {
    const payment = await fetchPaymentStatus(reservationId);

    if (payment.status === "paid") {
      if (payment.paymentType === "tip") {
        showFinal("Thank you for the support.", "Your contribution has been received. I truly appreciate you.", true);
        if (receiptCard) receiptCard.hidden = true;
        if (snapchatPanel) snapchatPanel.hidden = true;
        if (receiptDownload) receiptDownload.hidden = true;
        return;
      }

      showFinal("Request confirmed.", "Your payment was verified. Review your official receipt below.", true);
      renderReceipt(payment);
      return;
    }

    if (payment.status === "failed") {
      showFinal("Payment wasn’t completed.", "No confirmed payment was received. You can try again whenever you’re ready.", false);
      return;
    }

    checks += 1;
    if (checks >= maximumChecks) {
      showFinal("Still confirming…", "Your payment may still complete shortly. Please refresh this page in a moment.", false);
      return;
    }

    window.setTimeout(checkPaymentStatus, 2000);
  } catch (error) {
    checks += 1;
    if (checks >= maximumChecks || error.message === "Payment reference not found.") {
      showFinal("Confirmation is temporarily unavailable.", "Please check back shortly.", false);
      return;
    }
    window.setTimeout(checkPaymentStatus, 2000);
  }
}

checkPaymentStatus();
