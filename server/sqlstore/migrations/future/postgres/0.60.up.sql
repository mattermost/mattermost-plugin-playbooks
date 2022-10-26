update IR_UserInfo
set DigestNotificationSettingsJSON = DigestNotificationSettingsJSON ||
    json_build_object('DisableWeeklyDigest', DigestNotificationSettingsJSON::json->>'DisableDailyDigest')
