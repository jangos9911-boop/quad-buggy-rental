-- Fleet Management 2.0
ALTER TABLE vehicles ADD COLUMN current_odometer REAL NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN current_fuel_level REAL;
ALTER TABLE vehicles ADD COLUMN purchase_date TEXT;
ALTER TABLE vehicles ADD COLUMN next_service_date TEXT;
ALTER TABLE vehicles ADD COLUMN next_service_odometer REAL;
ALTER TABLE vehicles ADD COLUMN insurance_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN registration_expiry TEXT;
ALTER TABLE vehicles ADD COLUMN notes TEXT;

CREATE TABLE IF NOT EXISTS vehicle_inspections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 vehicle_id INTEGER NOT NULL,
 rental_id INTEGER,
 inspection_type TEXT NOT NULL,
 inspected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 odometer REAL,
 fuel_level REAL,
 condition_status TEXT NOT NULL DEFAULT 'good',
 damage_notes TEXT,
 checklist_json TEXT,
 created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_business ON vehicle_inspections(business_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id,inspected_at);

CREATE TABLE IF NOT EXISTS vehicle_damage (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 vehicle_id INTEGER NOT NULL,
 rental_id INTEGER,
 reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 location TEXT,
 severity TEXT NOT NULL DEFAULT 'minor',
 description TEXT NOT NULL,
 estimated_cost REAL NOT NULL DEFAULT 0,
 repair_status TEXT NOT NULL DEFAULT 'open',
 resolved_at TEXT,
 notes TEXT,
 created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_vehicle_damage_business ON vehicle_damage(business_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_damage_vehicle ON vehicle_damage(vehicle_id,repair_status);

CREATE TABLE IF NOT EXISTS vehicle_service_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 vehicle_id INTEGER NOT NULL,
 service_date TEXT NOT NULL,
 service_type TEXT NOT NULL,
 odometer REAL,
 vendor TEXT,
 cost REAL NOT NULL DEFAULT 0,
 next_due_date TEXT,
 next_due_odometer REAL,
 status TEXT NOT NULL DEFAULT 'completed',
 notes TEXT,
 created_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_business ON vehicle_service_history(business_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_vehicle ON vehicle_service_history(vehicle_id,service_date);
