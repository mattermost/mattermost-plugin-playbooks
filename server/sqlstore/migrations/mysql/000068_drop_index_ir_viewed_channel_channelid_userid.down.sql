SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'IR_ViewedChannel'
        AND table_schema = DATABASE()
        AND index_name = 'IR_ViewedChannel_ChannelID_UserID'
    ) > 0,
    'SELECT 1',
    'CREATE UNIQUE INDEX IR_ViewedChannel_ChannelID_UserID ON IR_ViewedChannel (ChannelID, UserID);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
