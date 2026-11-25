import { createCheckoutController } from "./checkout-controller.js?v=20261124-4";
import { paymentOptions, stripeAppearance } from "./config.js?v=20261124-4";
import { createCheckoutUi } from "./checkout-ui.js?v=20261124-4";

const ui = createCheckoutUi();
const checkout = createCheckoutController({ ui, appearance: stripeAppearance });

const customToggle = document.querySelector("#custom-toggle");
const customTray = document.querySelector("#custom-tray");
const customSubmit = document.querySelector("#custom-submit");
const queueNumberEl = document.querySelector("#queue-number");
const customAddOns = document.querySelectorAll("[data-custom-addon]");
const actionCards = document.querySelectorAll(".action-card");

const tipToggle = document.querySelector("#tip-toggle");
const tipTray = document.querySelector("#tip-tray");
const tipPills = document.querySelectorAll(".tip-pill");
const tipThumb = document.querySelector(".tip-segmented__thumb");
const tipSubmit = document.querySelector("#tip-submit");

let isPriority = false;
let includesPremadeAccess = false;
let selectedTipAmount = 25;

function getQueuePositions() {
  let base = parseInt(localStorage.getItem("roxy_custom_queue_base"), 10);
  if (isNaN(base) || base < 5 || base > 38) {
    base = Math.floor(Math.random() * (38 - 5 + 1)) + 5;
    localStorage.setItem("roxy_custom_queue_base", String(base));
  }

  let priority = parseInt(localStorage.getItem("roxy_custom_queue_priority"), 10);
  if (isNaN(priority)) {
    if (base > 20) {
      priority = Math.floor(Math.random() * (10 - 6 + 1)) + 6; // top 10 (6-10)
    } else if (base >= 11) {
      priority = Math.floor(Math.random() * (8 - 5 + 1)) + 5; // top 10 (5-8)
    } else {
      priority = Math.floor(Math.random() * (4 - 1 + 1)) + 1; // top 4 (1-4)
    }
    localStorage.setItem("roxy_custom_queue_priority", String(priority));
  }

  return { base, priority };
}

function renderQueueStatus() {
  if (!queueNumberEl) return;
  const { base, priority } = getQueuePositions();
  const currentNumber = isPriority ? priority : base;
  queueNumberEl.textContent = `#${currentNumber}`;
}

function renderCustomSubmit() {
  if (!customSubmit) return;
  const addOnTotal = (isPriority ? 16.99 : 0) + (includesPremadeAccess ? 10 : 0);
  customSubmit.textContent = addOnTotal
    ? `Continue with request (+$${addOnTotal.toFixed(2)})`
    : "Continue with request";
}

function selectActionCard(card) {
  actionCards.forEach((actionCard) => {
    const isSelected = actionCard === card;
    actionCard.classList.toggle("is-selected", isSelected);
    actionCard.setAttribute("aria-checked", String(isSelected));
    actionCard.closest(".support-card")?.classList.toggle("is-selected", isSelected);
  });
}

function closeCustomTray() {
  if (!customTray || !customToggle) return;
  customTray.hidden = true;
  customToggle.setAttribute("aria-expanded", "false");
}

function openCustomTray() {
  if (!customTray || !customToggle) return;
  if (customTray.hidden) {
    closeTipTray();
    renderQueueStatus();
  }
  customTray.hidden = false;
  customToggle.setAttribute("aria-expanded", "true");
}

function closeTipTray() {
  if (!tipTray || !tipToggle) return;
  tipTray.hidden = true;
  tipToggle.setAttribute("aria-expanded", "false");
}

function syncTipThumb() {
  if (!tipThumb) return;
  const activeIndex = Array.from(tipPills).findIndex((p) => p.classList.contains("is-selected"));
  if (activeIndex >= 0) {
    tipThumb.style.transform = `translateX(${activeIndex * 100}%)`;
  }
}

function openTipTray() {
  if (!tipTray || !tipToggle) return;
  if (tipTray.hidden) {
    closeCustomTray();
  }
  tipTray.hidden = false;
  tipToggle.setAttribute("aria-expanded", "true");
  syncTipThumb();
}

if (customToggle) {
  customToggle.addEventListener("click", () => {
    selectActionCard(customToggle);
    openCustomTray();
  });
}

customAddOns.forEach((addOn) => {
  addOn.addEventListener("click", () => {
    const isSelected = !addOn.classList.contains("is-selected");
    addOn.classList.toggle("is-selected", isSelected);
    addOn.setAttribute("aria-checked", String(isSelected));
    isPriority = document.querySelector('[data-custom-addon="priority"]')?.classList.contains("is-selected") ?? false;
    includesPremadeAccess = document.querySelector('[data-custom-addon="premade-access"]')?.classList.contains("is-selected") ?? false;
    renderQueueStatus();
    renderCustomSubmit();
  });
});

if (customSubmit) {
  customSubmit.addEventListener("click", () => {
    const selectedAddOns = [
      isPriority && "Priority push",
      includesPremadeAccess && "Pre-made access",
    ].filter(Boolean);
    const label = selectedAddOns.length
      ? `Request custom content — ${selectedAddOns.join(" + ")}`
      : "Request custom content";
    checkout.select("custom", label, {
      priority: isPriority,
      premadeAccess: includesPremadeAccess,
      triggerButton: customSubmit,
    });
  });
}

if (tipToggle) {
  tipToggle.addEventListener("click", () => {
    selectActionCard(tipToggle);
    openTipTray();
  });
}

tipPills.forEach((pill, index) => {
  pill.addEventListener("click", () => {
    tipPills.forEach((p) => {
      p.classList.remove("is-selected");
      p.setAttribute("aria-checked", "false");
    });
    pill.classList.add("is-selected");
    pill.setAttribute("aria-checked", "true");
    selectedTipAmount = Number(pill.dataset.amount);

    if (tipThumb) {
      tipThumb.style.transform = `translateX(${index * 100}%)`;
    }

    if (tipSubmit) {
      tipSubmit.innerHTML = `<span>Continue with $${selectedTipAmount}</span>`;
    }
  });
});

syncTipThumb();

if (tipSubmit) {
  tipSubmit.addEventListener("click", () => {
    checkout.select("tip", `Leave a little something ($${selectedTipAmount})`, {
      amount: selectedTipAmount * 100,
      triggerButton: tipSubmit,
    });
  });
}

document.querySelectorAll("[data-payment-type]").forEach((button) => {
  button.addEventListener("click", () => {
    selectActionCard(button);
    closeTipTray();
    closeCustomTray();
    const paymentType = button.dataset.paymentType;
    checkout.select(paymentType, paymentOptions[paymentType]);
  });
});

ui.closeButton.addEventListener("click", () => checkout.close());
ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  checkout.submit();
});
