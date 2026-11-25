CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checkout_ready', 'paid', 'failed', 'cancelled', 'expired')),
  handypay_intent_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  paid_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_token
  ON payment_requests(token);
