ALTER TABLE checkout_reservations
  ADD COLUMN premade_access INTEGER NOT NULL DEFAULT 0 CHECK (premade_access IN (0, 1));
