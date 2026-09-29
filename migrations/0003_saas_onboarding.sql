-- Multi-tenant SaaS upgrade
-- Run after migrations/0001_production.sql

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'AED',
  vat_rate REAL NOT NULL DEFAULT 5,
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  invoice_prefix TEXT NOT NULL DEFAULT 'RNT',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO businesses(id,name,slug,currency,vat_rate,timezone,invoice_prefix)
SELECT 1,business_name,'default',currency,vat_rate,timezone,invoice_prefix FROM settings WHERE id=1;

ALTER TABLE users ADD COLUMN business_id INTEGER;
ALTER TABLE vehicles ADD COLUMN business_id INTEGER;
ALTER TABLE customers ADD COLUMN business_id INTEGER;
ALTER TABLE services ADD COLUMN business_id INTEGER;
ALTER TABLE rentals ADD COLUMN business_id INTEGER;
ALTER TABLE payments ADD COLUMN business_id INTEGER;
ALTER TABLE expenses ADD COLUMN business_id INTEGER;
ALTER TABLE maintenance ADD COLUMN business_id INTEGER;
ALTER TABLE audit_log ADD COLUMN business_id INTEGER;

UPDATE users SET business_id=1 WHERE business_id IS NULL;
UPDATE vehicles SET business_id=1 WHERE business_id IS NULL;
UPDATE customers SET business_id=1 WHERE business_id IS NULL;
UPDATE services SET business_id=1 WHERE business_id IS NULL;
UPDATE rentals SET business_id=1 WHERE business_id IS NULL;
UPDATE payments SET business_id=1 WHERE business_id IS NULL;
UPDATE expenses SET business_id=1 WHERE business_id IS NULL;
UPDATE maintenance SET business_id=1 WHERE business_id IS NULL;
UPDATE audit_log SET business_id=1 WHERE business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_business ON vehicles(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_rentals_business ON rentals(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_business ON maintenance(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_log(business_id);


-- SaaS onboarding and trial lifecycle
ALTER TABLE businesses ADD COLUMN owner_user_id INTEGER;
ALTER TABLE businesses ADD COLUMN trial_ends_at TEXT;
ALTER TABLE businesses ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trialing';

UPDATE businesses
SET trial_ends_at=COALESCE(trial_ends_at,datetime(created_at,'+14 days')),
    subscription_status=COALESCE(subscription_status,'trialing');

CREATE INDEX IF NOT EXISTS idx_businesses_subscription ON businesses(subscription_status);
