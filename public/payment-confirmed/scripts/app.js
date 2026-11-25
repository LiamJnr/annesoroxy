import { fetchPaymentStatus } from "./payment-status.js?v=20261124-7";

const title = document.querySelector("#confirmation-title");
const message = document.querySelector("#confirmation-message");
const mark = document.querySelector("#confirmation-mark");
const eyebrow = document.querySelector("#confirmation-eyebrow");
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
const receiptAuth = document.querySelector("#receipt-auth");

const reservationId = new URLSearchParams(window.location.search).get("reservation_id");
const maximumChecks = 45;
let checks = 0;
let confirmedCustomPayment;

function computeSecurityToken(id, timestamp) {
  const cleanId = (id || "").replace(/-/g, "").toUpperCase();
  const seed = (timestamp ? new Date(timestamp).getTime() : Date.now()).toString(16).toUpperCase();
  const partA = cleanId.slice(0, 4);
  const partB = cleanId.slice(4, 8);
  const partC = seed.slice(-4).padStart(4, "X");
  return `ROXY-AUTH-${partA}-${partB}-${partC}`;
}

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
  if (receiptPrompt) receiptPrompt.hidden = true;
  if (receiptCard) receiptCard.hidden = true;
  if (snapchatLink) snapchatLink.hidden = true;
  if (homeLink) homeLink.hidden = false;
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
  if (receiptAuth) receiptAuth.textContent = computeSecurityToken(payment.id, payment.paidAt);

  receiptCard.hidden = false;
}

if (receiptReveal) {
  receiptReveal.addEventListener("click", () => {
    if (!confirmedCustomPayment) return;

    // Trigger file download
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = `/api/premade-access-receipt?reservation_id=${encodeURIComponent(confirmedCustomPayment.id)}`;
    downloadAnchor.download = `roxy-receipt-${confirmedCustomPayment.id.slice(0, 8)}.html`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    // Render receipt view in-place for screenshotting
    renderReceipt(confirmedCustomPayment);
    if (receiptPrompt) receiptPrompt.hidden = true;
    if (eyebrow) eyebrow.textContent = "ROXY / OFFICIAL RECEIPT";
    if (title) title.textContent = "Your Receipt";
    if (message) message.textContent = "Screenshot this receipt and send it to Snapchat @annesoroxy to begin your request.";
    if (snapchatLink) snapchatLink.hidden = false;
    if (homeLink) homeLink.hidden = false;

    receiptCard.scrollIntoView({ behavior: "smooth", block: "start" });
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
        if (homeLink) homeLink.hidden = false;
        return;
      }

      title.textContent = "Request confirmed.";
      message.textContent = "Your payment was verified. Download your receipt to continue.";
      confirmedCustomPayment = payment;
      if (receiptPrompt) receiptPrompt.hidden = false;
      if (receiptCard) receiptCard.hidden = true;
      if (snapchatLink) snapchatLink.hidden = true;
      if (homeLink) homeLink.hidden = true;
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
