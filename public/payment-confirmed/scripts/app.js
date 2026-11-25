import { fetchPaymentStatus } from "./payment-status.js?v=20261124-6";

const title = document.querySelector("#confirmation-title");
const message = document.querySelector("#confirmation-message");
const mark = document.querySelector("#confirmation-mark");
const homeLink = document.querySelector("#home-link");
const receiptPrompt = document.querySelector("#receipt-prompt");
const receiptCard = document.querySelector("#receipt-card");
const receiptReveal = document.querySelector("#receipt-reveal");
const snapchatLink = document.querySelector("#snapchat-link");

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
let confirmedCustomPayment;

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
}

if (receiptReveal) {
  receiptReveal.addEventListener("click", () => {
    if (!confirmedCustomPayment) return;
    renderReceipt(confirmedCustomPayment);
    receiptPrompt.hidden = true;
    snapchatLink.hidden = false;
    homeLink.hidden = false;
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
        if (receiptPrompt) receiptPrompt.hidden = true;
        if (snapchatLink) snapchatLink.hidden = true;
        return;
      }

      title.textContent = "Request confirmed.";
      message.textContent = "Your payment was verified. Open your receipt to continue.";
      confirmedCustomPayment = payment;
      receiptPrompt.hidden = false;
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
