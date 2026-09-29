-- Staff profile fields and tenant-scoped audit history
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN job_title TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

ALTER TABLE audit_log ADD COLUMN business_id INTEGER;
UPDATE audit_log SET business_id=(SELECT business_id FROM users WHERE users.id=audit_log.user_id) WHERE business_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_users_business_role ON users(business_id,role,active);
