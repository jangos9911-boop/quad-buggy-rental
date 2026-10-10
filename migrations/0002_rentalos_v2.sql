-- RentalOS v2: optional booking times, flexible vehicle types and driver commission tracking.
-- Apply once to the existing production D1 database after 0001_production.sql.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

ALTER TABLE settings ADD COLUMN business_type TEXT NOT NULL DEFAULT 'vehicle-rental';
ALTER TABLE settings ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'starter';

ALTER TABLE rentals RENAME TO rentals_v1;

CREATE TABLE rentals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  vehicle_id INTEGER,
  service_id INTEGER,
  start_at TEXT,
  end_at TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 5,
  vat_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  deposit REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  driver_name TEXT,
  purchase_rate REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  business_type TEXT NOT NULL DEFAULT 'vehicle-rental'
);

INSERT INTO rentals (
  id, invoice_no, customer_id, vehicle_id, service_id, start_at, end_at,
  quantity, unit_price, subtotal, discount, vat_rate, vat_amount, total,
  deposit, payment_status, status, notes, created_by, created_at
)
SELECT
  id, invoice_no, customer_id, vehicle_id, service_id, start_at, end_at,
  quantity, unit_price, subtotal, discount, vat_rate, vat_amount, total,
  deposit, payment_status, status, notes, created_by, created_at
FROM rentals_v1;

DROP TABLE rentals_v1;

CREATE INDEX IF NOT EXISTS idx_rentals_start ON rentals(start_at);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle ON rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rentals_driver ON rentals(driver_name);
CREATE INDEX IF NOT EXISTS idx_payments_rental ON payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);

UPDATE settings
SET business_name='RentalOS', business_type='vehicle-rental'
WHERE id=1;

COMMIT;
PRAGMA foreign_keys=ON;
