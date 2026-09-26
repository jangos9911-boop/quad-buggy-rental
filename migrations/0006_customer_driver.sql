-- RentalOS customer and driver records
ALTER TABLE customers ADD COLUMN date_of_birth TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN driver_license_number TEXT;
ALTER TABLE customers ADD COLUMN driver_license_country TEXT;
ALTER TABLE customers ADD COLUMN driver_license_expiry TEXT;
ALTER TABLE customers ADD COLUMN passport_expiry TEXT;
ALTER TABLE customers ADD COLUMN emergency_contact TEXT;
ALTER TABLE customers ADD COLUMN emergency_phone TEXT;
ALTER TABLE customers ADD COLUMN document_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_license_expiry ON customers(driver_license_expiry);
CREATE INDEX IF NOT EXISTS idx_customers_passport_expiry ON customers(passport_expiry);
