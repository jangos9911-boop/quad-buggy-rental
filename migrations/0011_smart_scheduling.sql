-- Smart Availability & Scheduling
CREATE INDEX IF NOT EXISTS idx_rentals_schedule ON rentals(business_id,vehicle_id,start_at,end_at);
CREATE INDEX IF NOT EXISTS idx_rentals_status_schedule ON rentals(business_id,status,start_at,end_at);
