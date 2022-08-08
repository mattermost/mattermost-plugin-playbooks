SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'IR_Incident'
        AND table_schema = DATABASE()
        AND column_name = 'ActiveStageTitle'
    ),
    'ALTER TABLE IR_Incident ADD COLUMN ActiveStageTitle VARCHAR(1024) DEFAULT "";',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


UPDATE IR_Incident 
SET ActiveStageTitle = JSON_EXTRACT(`ChecklistsJSON` -> '$[activestage]', '$.title') 
WHERE JSON_LENGTH(ChecklistsJSON) IS NOT NULL
AND JSON_LENGTH(ChecklistsJSON) > ActiveStage
AND ActiveStage >= 0;
