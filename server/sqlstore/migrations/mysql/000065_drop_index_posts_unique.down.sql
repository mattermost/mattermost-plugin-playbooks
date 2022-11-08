SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND index_name = 'posts_unique'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE IR_StatusPosts ADD CONSTRAINT posts_unique UNIQUE (IncidentID, PostID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
