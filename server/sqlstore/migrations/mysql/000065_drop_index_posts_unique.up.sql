SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_StatusPosts'
        AND table_schema = DATABASE()
        AND index_name = 'posts_unique'
    ) > 0,
    'DROP INDEX posts_unique ON IR_StatusPosts;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;
