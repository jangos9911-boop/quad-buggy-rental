CREATE TABLE IF NOT EXISTS customer_documents (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 business_id INTEGER NOT NULL,
 customer_id INTEGER NOT NULL,
 document_type TEXT NOT NULL,
 document_number TEXT,
 issue_date TEXT,
 expiry_date TEXT,
 notes TEXT,
 status TEXT NOT NULL DEFAULT 'active',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_customer_documents_business ON customer_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_expiry ON customer_documents(expiry_date);
