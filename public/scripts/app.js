import { createCheckoutController } from "./checkout-controller.js";
import { paymentOptions, stripeAppearance } from "./config.js";
import { createCheckoutUi } from "./checkout-ui.js";

const ui = createCheckoutUi();
const checkout = createCheckoutController({ ui, appearance: stripeAppearance });

const customToggle = document.querySelector("#custom-toggle");
const customTray = document.querySelector("#custom-tray");
const customSubmit = document.querySelector("#custom-submit");
const queueNumberEl = document.querySelector("#queue-number");
const priorityPills = document.querySelectorAll(".priority-pill");

const tipToggle = document.querySelector("#tip-toggle");
const tipTray = document.querySelector("#tip-tray");
const tipPills = document.querySelectorAll(".tip-pill");
const tipSubmit = document.querySelector("#tip-submit");

let isPriority = false;
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

function closeCustomTray() {
  if (!customTray || !customToggle) return;
  customTray.hidden = true;
  customToggle.setAttribute("aria-expanded", "false");
}

function toggleCustomTray() {
  if (!customTray || !customToggle) return;
  const isOpening = customTray.hidden;
  if (isOpening) {
    closeTipTray();
    renderQueueStatus();
  }
  customTray.hidden = !isOpening;
  customToggle.setAttribute("aria-expanded", String(isOpening));
}

function closeTipTray() {
  if (!tipTray || !tipToggle) return;
  tipTray.hidden = true;
  tipToggle.setAttribute("aria-expanded", "false");
}

function toggleTipTray() {
  if (!tipTray || !tipToggle) return;
  const isOpening = tipTray.hidden;
  if (isOpening) {
    closeCustomTray();
  }
  tipTray.hidden = !isOpening;
  tipToggle.setAttribute("aria-expanded", String(isOpening));
}

if (customToggle) {
  customToggle.addEventListener("click", () => {
    toggleCustomTray();
  });
}

priorityPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    priorityPills.forEach((p) => {
      p.classList.remove("is-selected");
      p.setAttribute("aria-checked", "false");
    });
    pill.classList.add("is-selected");
    pill.setAttribute("aria-checked", "true");
    isPriority = pill.dataset.priority === "true";
    renderQueueStatus();

    if (customSubmit) {
      customSubmit.innerHTML = isPriority
        ? "<span>Continue with Priority (+$10)</span>"
        : "<span>Continue with Standard Queue</span>";
    }
  });
});

if (customSubmit) {
  customSubmit.addEventListener("click", () => {
    const label = isPriority
      ? "Request custom content (Priority Rush)"
      : "Request custom content";
    checkout.select("custom", label, { priority: isPriority });
  });
}

if (tipToggle) {
  tipToggle.addEventListener("click", () => {
    toggleTipTray();
  });
}

tipPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    tipPills.forEach((p) => {
      p.classList.remove("is-selected");
      p.setAttribute("aria-checked", "false");
    });
    pill.classList.add("is-selected");
    pill.setAttribute("aria-checked", "true");
    selectedTipAmount = Number(pill.dataset.amount);

    if (tipSubmit) {
      tipSubmit.innerHTML = `<span>Continue with $${selectedTipAmount}</span>`;
    }
  });
});

if (tipSubmit) {
  tipSubmit.addEventListener("click", () => {
    checkout.select("tip", `Leave a little something ($${selectedTipAmount})`, {
      amount: selectedTipAmount * 100,
    });
  });
}

document.querySelectorAll("[data-payment-type]").forEach((button) => {
  button.addEventListener("click", () => {
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
