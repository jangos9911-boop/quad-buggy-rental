-- RentalOS operational controls, vehicle profitability, and data migration
ALTER TABLE businesses ADD COLUMN trn TEXT;
ALTER TABLE businesses ADD COLUMN address TEXT;

CREATE TABLE IF NOT EXISTS rental_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  rental_id INTEGER,
  vehicle_id INTEGER,
  customer_id INTEGER,
  charge_type TEXT NOT NULL DEFAULT 'other',
  amount REAL NOT NULL DEFAULT 0,
  incurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  reference TEXT,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'unbilled',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rental_charges_business ON rental_charges(business_id,incurred_at);
CREATE INDEX IF NOT EXISTS idx_rental_charges_rental ON rental_charges(rental_id,business_id);

CREATE TABLE IF NOT EXISTS rental_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  rental_id INTEGER NOT NULL,
  amount_received REAL NOT NULL DEFAULT 0,
  amount_deducted REAL NOT NULL DEFAULT 0,
  amount_refunded REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  refund_date TEXT,
  refund_method TEXT,
  refund_reference TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_deposit_unique ON rental_deposits(business_id,rental_id);

CREATE TABLE IF NOT EXISTS cheque_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  rental_id INTEGER,
  customer_id INTEGER,
  amount REAL NOT NULL DEFAULT 0,
  cheque_number TEXT NOT NULL,
  cheque_date TEXT,
  bank_name TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  deposited_at TEXT,
  cleared_at TEXT,
  bounced_at TEXT,
  return_fee REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cheques_business ON cheque_payments(business_id,status,cheque_date);

CREATE TABLE IF NOT EXISTS vehicle_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  cost_date TEXT NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'other',
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vehicle_costs_business ON vehicle_costs(business_id,vehicle_id,cost_date);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  entity TEXT NOT NULL,
  file_name TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
