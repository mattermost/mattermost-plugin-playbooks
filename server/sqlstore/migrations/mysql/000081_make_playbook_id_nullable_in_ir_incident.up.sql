SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'PlaybookID'
        AND IS_NULLABLE = 'NO'
    ),
    'ALTER TABLE IR_Incident MODIFY PlaybookID VARCHAR(26) NULL DEFAULT NULL;',
    'SELECT 1;'
));

PREPARE modifyColumnIfExists FROM @preparedStatement;
EXECUTE modifyColumnIfExists;
DEALLOCATE PREPARE modifyColumnIfExists;

-- Update existing empty string PlaybookIDs to NULL for cleaner data
UPDATE IR_Incident SET PlaybookID = NULL WHERE PlaybookID = '';