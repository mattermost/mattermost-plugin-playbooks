-- Revert TeamID to NOT NULL (MM-66962 rollback)
-- WARNING: This will fail if any rows have NULL TeamID values

-- First, update any NULL values to empty string to allow constraint
UPDATE IR_Incident SET TeamID = '' WHERE TeamID IS NULL;

-- Add back the NOT NULL constraint
ALTER TABLE IR_Incident ALTER COLUMN TeamID SET NOT NULL;
