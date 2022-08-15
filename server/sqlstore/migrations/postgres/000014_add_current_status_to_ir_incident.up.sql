ALTER TABLE IR_Incident ADD COLUMN IF NOT EXISTS CurrentStatus TEXT NOT NULL DEFAULT 'Active';

UPDATE ir_incident 
SET CurrentStatus = 'Resolved'
WHERE EndAt != 0;
