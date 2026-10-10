-- Driver commission tracking for ATV, quad and buggy rentals.
-- These columns are already present in the live D1 database; this migration
-- records the schema change for fresh environments.
ALTER TABLE rentals ADD COLUMN purchase_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN driver_name TEXT;
ALTER TABLE rentals ADD COLUMN driver_commission_percent REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN rental_profit REAL NOT NULL DEFAULT 0;
ALTER TABLE rentals ADD COLUMN driver_commission_amount REAL NOT NULL DEFAULT 0;
