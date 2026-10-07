-- RentalOS multi-vertical rental foundation
CREATE TABLE IF NOT EXISTS rental_verticals (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO rental_verticals(code,name,icon,description,sort_order) VALUES
('car','Car Rental','🚗','Cars, SUVs, vans and commercial vehicles',10),
('bike','Bike & Scooter Rental','🛵','Motorcycles, scooters and bicycles',20),
('atv','ATV, Quad & Buggy','🏎️','ATVs, quads, buggies and adventure vehicles',30),
('marine','Boat & Watercraft Rental','🚤','Jet skis, boats and watercraft',40),
('equipment','Equipment & Machinery','🛠️','Tools, generators, machinery and industrial equipment',50),
('camera','Camera & Electronics','📷','Cameras, lenses, drones and electronics',60),
('event','Event & Party Rental','🎪','Furniture, tents, lighting and event inventory',70),
('fashion','Fashion & Accessory Rental','👗','Dresses, suits, jewellery and accessories',80),
('medical','Medical Equipment Rental','🩺','Home-care and medical equipment',90),
('property','Property & Space Rental','🏠','Apartments, offices, shops and other spaces',100),
('other','Other Rental Business','＋','Other rental assets and specialist businesses',110);

CREATE TABLE IF NOT EXISTS business_verticals (
  business_id INTEGER NOT NULL,
  vertical_code TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_id, vertical_code)
);

CREATE INDEX IF NOT EXISTS idx_business_verticals_business ON business_verticals(business_id, enabled);

CREATE TABLE IF NOT EXISTS rental_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  vertical_code TEXT NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  serial_number TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  status TEXT NOT NULL DEFAULT 'available',
  rate_hour REAL NOT NULL DEFAULT 0,
  rate_day REAL NOT NULL DEFAULT 0,
  rate_week REAL NOT NULL DEFAULT 0,
  rate_month REAL NOT NULL DEFAULT 0,
  location TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rental_assets_business ON rental_assets(business_id,status,vertical_code);
CREATE INDEX IF NOT EXISTS idx_rental_assets_serial ON rental_assets(business_id,serial_number);
