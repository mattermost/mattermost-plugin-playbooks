
update IR_UserInfo
set DigestNotificationSettingsJSON = JSON_REMOVE(DigestNotificationSettingsJSON, '$.DisableWeeklyDigest')
