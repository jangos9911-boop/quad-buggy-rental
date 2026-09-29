-- RentalOS business vertical
-- Adds a business type so one SaaS platform can serve different rental industries.
ALTER TABLE businesses ADD COLUMN business_type TEXT NOT NULL DEFAULT 'other';

UPDATE businesses
SET business_type='quad-buggy'
WHERE business_type='other' AND (lower(name) LIKE '%quad%' OR lower(name) LIKE '%buggy%');
