-- RentalOS production migration: make booking times optional for quad, buggy and ATV rentals.
-- Preserves all existing rental rows, business fields, deposits, pickup/return inspections and commission data.

ALTER TABLE rentals RENAME TO rentals_v1;

CREATE TABLE rentals_new (
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
 business_id INTEGER,
 pickup_at TEXT,
 return_at TEXT,
 pickup_odometer REAL,
 return_odometer REAL,
 pickup_fuel_level REAL,
 return_fuel_level REAL,
 pickup_damage TEXT,
 return_damage TEXT,
 deposit_status TEXT NOT NULL DEFAULT 'held',
 late_fee REAL NOT NULL DEFAULT 0,
 purchase_rate REAL NOT NULL DEFAULT 0,
 driver_name TEXT,
 driver_commission_percent REAL NOT NULL DEFAULT 0,
 driver_commission_amount REAL NOT NULL DEFAULT 0,
 rental_profit REAL NOT NULL DEFAULT 0
);

INSERT INTO rentals_new (
 id,invoice_no,customer_id,vehicle_id,service_id,start_at,end_at,quantity,unit_price,
 subtotal,discount,vat_rate,vat_amount,total,deposit,payment_status,status,notes,created_by,
 created_at,business_id,pickup_at,return_at,pickup_odometer,return_odometer,pickup_fuel_level,
 return_fuel_level,pickup_damage,return_damage,deposit_status,late_fee,purchase_rate,driver_name,
 driver_commission_percent,driver_commission_amount,rental_profit
)
SELECT
 id,invoice_no,customer_id,vehicle_id,service_id,start_at,end_at,quantity,unit_price,
 subtotal,discount,vat_rate,vat_amount,total,deposit,payment_status,status,notes,created_by,
 created_at,business_id,pickup_at,return_at,pickup_odometer,return_odometer,pickup_fuel_level,
 return_fuel_level,pickup_damage,return_damage,deposit_status,late_fee,purchase_rate,driver_name,
 driver_commission_percent,driver_commission_amount,rental_profit
FROM rentals_v1;

DROP TABLE rentals_v1;
ALTER TABLE rentals_new RENAME TO rentals;

CREATE INDEX IF NOT EXISTS idx_rentals_business ON rentals(business_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_driver_commission ON rentals(business_id, driver_name, created_at);
CREATE INDEX IF NOT EXISTS idx_rentals_pickup ON rentals(pickup_at);
CREATE INDEX IF NOT EXISTS idx_rentals_return ON rentals(return_at);
CREATE INDEX IF NOT EXISTS idx_rentals_schedule ON rentals(business_id,vehicle_id,start_at,end_at);
CREATE INDEX IF NOT EXISTS idx_rentals_start ON rentals(start_at);
CREATE INDEX IF NOT EXISTS idx_rentals_status_schedule ON rentals(business_id,status,start_at,end_at);
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle ON rentals(vehicle_id);

