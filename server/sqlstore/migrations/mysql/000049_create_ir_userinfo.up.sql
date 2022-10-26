CREATE TABLE IF NOT EXISTS IR_UserInfo
(
    ID                VARCHAR(26) PRIMARY KEY,
    LastDailyTodoDMAt BIGINT,
    DigestNotificationSettingsJSON JSON
);