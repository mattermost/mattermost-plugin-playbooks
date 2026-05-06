-- Support DM/GM channel checklists (MM-66962)
-- DM and GM channels have no team, so TeamID will be empty string for those runs.
-- While TEXT NOT NULL allows empty strings, we make it nullable for future flexibility
-- and to be explicit that "no team" is a valid state.

DO $$
BEGIN
    -- Drop the NOT NULL constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ir_incident'
        AND column_name = 'teamid'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE IR_Incident ALTER COLUMN TeamID DROP NOT NULL;
    END IF;
END
$$;

-- Note: Existing indexes on TeamID will continue to work with NULL/empty values
-- IR_Incident_TeamID and IR_Incident_TeamID_CommanderUserID indexes handle this properly
