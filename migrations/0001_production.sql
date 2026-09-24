-- Production schema for Quad & Buggy UAE Rental Desk
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), business_name TEXT NOT NULL DEFAULT 'Quad & Buggy UAE Rental', currency TEXT NOT NULL DEFAULT 'AED', vat_rate REAL NOT NULL DEFAULT 5, timezone TEXT NOT NULL DEFAULT 'Asia/Dubai', invoice_prefix TEXT NOT NULL DEFAULT 'RNT');
INSERT OR IGNORE INTO settings(id) VALUES(1);

CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'staff',active INTEGER NOT NULL DEFAULT 1,password_hash TEXT,password_salt TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS vehicles (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'Quad',registration TEXT,status TEXT NOT NULL DEFAULT 'available',rate_per_hour REAL NOT NULL DEFAULT 0,notes TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,email TEXT,nationality TEXT,id_reference TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'Other',price REAL NOT NULL DEFAULT 0,vat_rate REAL NOT NULL DEFAULT 5,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS rentals (id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_no TEXT NOT NULL UNIQUE,customer_id INTEGER,vehicle_id INTEGER,service_id INTEGER,start_at TEXT NOT NULL,end_at TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 1,unit_price REAL NOT NULL DEFAULT 0,subtotal REAL NOT NULL DEFAULT 0,discount REAL NOT NULL DEFAULT 0,vat_rate REAL NOT NULL DEFAULT 5,vat_amount REAL NOT NULL DEFAULT 0,total REAL NOT NULL DEFAULT 0,deposit REAL NOT NULL DEFAULT 0,payment_status TEXT NOT NULL DEFAULT 'unpaid',status TEXT NOT NULL DEFAULT 'completed',notes TEXT,created_by INTEGER,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT,rental_id INTEGER,payment_date TEXT NOT NULL,amount REAL NOT NULL,method TEXT NOT NULL,reference TEXT,notes TEXT,created_by INTEGER,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT,expense_date TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,amount REAL NOT NULL,vat_amount REAL NOT NULL DEFAULT 0,payment_method TEXT,vehicle_id INTEGER,notes TEXT,created_by INTEGER,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT,vehicle_id INTEGER,maintenance_date TEXT NOT NULL,type TEXT NOT NULL,description TEXT NOT NULL,cost REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'open',next_due_date TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id INTEGER,details_json TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_rentals_start ON rentals(start_at);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle ON rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_payments_rental ON payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance(vehicle_id);
