-- RentalOS pickup / return inspection data
ALTER TABLE rentals ADD COLUMN pickup_at TEXT;
ALTER TABLE rentals ADD COLUMN return_at TEXT;
ALTER TABLE rentals ADD COLUMN pickup_odometer REAL;
ALTER TABLE rentals ADD COLUMN return_odometer REAL;
ALTER TABLE rentals ADD COLUMN pickup_fuel_level REAL;
ALTER TABLE rentals ADD COLUMN return_fuel_level REAL;
ALTER TABLE rentals ADD COLUMN pickup_damage TEXT;
ALTER TABLE rentals ADD COLUMN return_damage TEXT;
ALTER TABLE rentals ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'held';
ALTER TABLE rentals ADD COLUMN late_fee REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rentals_pickup ON rentals(pickup_at);
CREATE INDEX IF NOT EXISTS idx_rentals_return ON rentals(return_at);
