ALTER TABLE payment_requests ADD COLUMN client_secret TEXT;
ALTER TABLE payment_requests ADD COLUMN publishable_key TEXT;
ALTER TABLE payment_requests ADD COLUMN stripe_account TEXT;
