-- Add RunID column to IR_MetricConfig to support metrics for standalone runs
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_MetricConfig'
        AND table_schema = DATABASE()
        AND column_name = 'RunID'
    ),
    'ALTER TABLE IR_MetricConfig ADD COLUMN RunID VARCHAR(26) NULL;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

-- Create index for RunID lookups
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_MetricConfig'
        AND table_schema = DATABASE()
        AND index_name = 'IR_MetricConfig_RunID'
    ),
    'CREATE INDEX IR_MetricConfig_RunID ON IR_MetricConfig(RunID);',
    'SELECT 1;'
));

PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;