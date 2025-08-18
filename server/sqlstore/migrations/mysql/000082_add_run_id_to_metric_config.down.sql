-- Drop the RunID index if it exists
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_MetricConfig'
        AND table_schema = DATABASE()
        AND index_name = 'IR_MetricConfig_RunID'
    ),
    'DROP INDEX IR_MetricConfig_RunID ON IR_MetricConfig;',
    'SELECT 1;'
));

PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

-- Remove RunID column
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_MetricConfig'
        AND table_schema = DATABASE()
        AND column_name = 'RunID'
    ),
    'ALTER TABLE IR_MetricConfig DROP COLUMN RunID;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;