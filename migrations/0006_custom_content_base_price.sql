-- The public custom-content flow displays a $5.00 baseline. Keep the
-- database configuration aligned with that approved price before deployment.
UPDATE payment_offerings
   SET amount_cents = 500
 WHERE payment_type = 'custom';
