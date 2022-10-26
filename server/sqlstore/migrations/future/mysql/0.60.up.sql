update IR_UserInfo
set DigestNotificationSettingsJSON =
    JSON_SET(DigestNotificationSettingsJSON, '$.DisableWeeklyDigest',
             JSON_EXTRACT(DigestNotificationSettingsJSON, '$.DisableDailyDigest'))
