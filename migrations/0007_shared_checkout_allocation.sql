-- HandyPay's current live embedded-checkout processing capacity is shared
-- across every payment type. Amounts are stored in cents: $1,500 = 150000.
CREATE TABLE IF NOT EXISTS checkout_allocation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  limit_cents INTEGER NOT NULL CHECK (limit_cents >= 0),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK (used_cents >= 0),
  CHECK (used_cents <= limit_cents)
);

INSERT OR IGNORE INTO checkout_allocation (id, limit_cents, used_cents)
VALUES (1, 150000, 0);
