-- RentalOS manual subscription billing and platform administration
ALTER TABLE businesses ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE businesses ADD COLUMN subscription_ends_at TEXT;

CREATE TABLE IF NOT EXISTS subscription_payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  requested_by INTEGER NOT NULL,
  plan TEXT NOT NULL,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  payment_reference TEXT NOT NULL,
  payment_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id),
  FOREIGN KEY(requested_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_business ON subscription_payment_requests(business_id,created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_requests_status ON subscription_payment_requests(status,created_at);

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
