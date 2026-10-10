-- Optional timing and guide/driver commission details for ATV and buggy rentals.
-- Empty start_at/end_at values remain valid for walk-in or flexible-duration rentals.
ALTER TABLE rentals ADD COLUMN purchase_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN driver_name TEXT;
ALTER TABLE rentals ADD COLUMN driver_commission_percent REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN driver_commission_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN rental_profit REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rentals_driver_commission
ON rentals(business_id, driver_name, created_at);