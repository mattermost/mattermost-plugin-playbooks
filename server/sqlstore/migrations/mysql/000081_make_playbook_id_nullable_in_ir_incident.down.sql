-- Convert NULL PlaybookIDs back to empty strings for rollback
UPDATE IR_Incident SET PlaybookID = '' WHERE PlaybookID IS NULL;

SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'PlaybookID'
        AND IS_NULLABLE = 'YES'
    ),
    'ALTER TABLE IR_Incident MODIFY PlaybookID VARCHAR(26) NOT NULL DEFAULT "";',
    'SELECT 1;'
));

PREPARE modifyColumnIfExists FROM @preparedStatement;
EXECUTE modifyColumnIfExists;
DEALLOCATE PREPARE modifyColumnIfExists;