CREATE TABLE IF NOT EXISTS rental_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 rental_id INTEGER NOT NULL,
 type TEXT NOT NULL,
 amount REAL NOT NULL DEFAULT 0,
 payment_method TEXT,
 reference TEXT,
 notes TEXT,
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rental_transactions_business ON rental_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_rental_transactions_rental ON rental_transactions(rental_id);
