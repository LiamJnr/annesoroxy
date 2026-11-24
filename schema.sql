-- Run this against the D1 database bound to PAYMENTS_DB before deploying payments.
-- Values are intentionally not seeded: set business-approved price and checkout limits yourself.

CREATE TABLE IF NOT EXISTS payment_offerings (
  payment_type TEXT PRIMARY KEY CHECK (payment_type IN ('custom', 'premade', 'tip')),
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  checkout_limit INTEGER NOT NULL CHECK (checkout_limit >= 0),
  checkout_used INTEGER NOT NULL DEFAULT 0 CHECK (checkout_used >= 0),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  CHECK (checkout_used <= checkout_limit)
);

CREATE TABLE IF NOT EXISTS checkout_reservations (
  id TEXT PRIMARY KEY,
  payment_type TEXT NOT NULL REFERENCES payment_offerings(payment_type),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  handypay_intent_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'checkout_ready', 'creation_failed', 'paid', 'failed')),
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_checkout_reservations_intent
  ON checkout_reservations(handypay_intent_id);

CREATE TABLE IF NOT EXISTS handypay_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Example configuration — replace every value with the approved live configuration,
-- then set active = 1 only when ready to accept that payment type.
--
-- INSERT INTO payment_offerings
--   (payment_type, label, amount_cents, currency, checkout_limit, active)
-- VALUES
--   ('custom', 'Custom content', 5000, 'usd', 20, 0),
--   ('premade', 'Pre-made content', 2500, 'usd', 40, 0),
--   ('tip', 'Supporter tip', 500, 'usd', 100, 0);
