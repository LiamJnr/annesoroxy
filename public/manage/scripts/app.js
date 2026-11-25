const form = document.querySelector("#request-form");
const description = document.querySelector("#description");
const amount = document.querySelector("#amount");
const expiresAt = document.querySelector("#expires-at");
const status = document.querySelector("#form-status");
const newLink = document.querySelector("#new-link");
const newLinkDescription = document.querySelector("#new-link-description");
const newLinkValue = document.querySelector("#new-link-value");
const copyLink = document.querySelector("#copy-link");
const list = document.querySelector("#request-list");
const refresh = document.querySelector("#refresh-list");

function money(cents) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function linkFor(token) { return `${window.location.origin}/pay/${token}`; }
function statusLabel(request) { return request.status === "open" && request.expiresAt && request.expiresAt <= Date.now() ? "expired" : request.status; }

function renderRequests(requests) {
  if (!requests.length) { list.textContent = "No private links yet."; return; }
  list.replaceChildren(...requests.map((request) => {
    const item = document.createElement("article");
    item.className = "request";
    const meta = request.expiresAt ? `Expires ${new Date(request.expiresAt).toLocaleString()}` : "No expiry";
    item.innerHTML = `<div><strong></strong><p></p></div><div class="request__side"><span class="request__status"></span><button type="button">Copy link</button></div>`;
    item.querySelector("strong").textContent = request.description;
    item.querySelector("p").textContent = `${money(request.amountCents)} · ${meta}`;
    item.querySelector(".request__status").textContent = statusLabel(request);
    item.querySelector("button").addEventListener("click", () => navigator.clipboard.writeText(linkFor(request.token)));
    return item;
  }));
}

async function loadRequests() {
  list.textContent = "Loading requests…";
  try {
    const response = await fetch("/manage/api/payment-requests", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    renderRequests(payload.requests);
  } catch { list.textContent = "Could not load private links. Confirm Cloudflare Access is configured for /manage/*."; }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amountCents = Math.round(Number(amount.value) * 100);
  const expiry = expiresAt.value ? new Date(expiresAt.value).getTime() : null;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  status.textContent = "Creating private link…";
  try {
    const response = await fetch("/manage/api/payment-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: description.value, amountCents, expiresAt: expiry }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    const url = linkFor(payload.request.token);
    newLinkDescription.textContent = `${payload.request.description} · ${money(payload.request.amountCents)}`;
    newLinkValue.textContent = url;
    newLink.hidden = false;
    status.textContent = "Private payment link created.";
    form.reset();
    await loadRequests();
  } catch (error) { status.textContent = error.message || "Could not create the link."; } finally { submit.disabled = false; }
});

copyLink.addEventListener("click", async () => { await navigator.clipboard.writeText(newLinkValue.textContent); copyLink.textContent = "Copied"; setTimeout(() => { copyLink.textContent = "Copy"; }, 1500); });
refresh.addEventListener("click", loadRequests);
loadRequests();
