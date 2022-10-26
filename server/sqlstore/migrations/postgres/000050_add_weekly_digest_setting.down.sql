UPDATE IR_UserInfo
SET DigestNotificationSettingsJSON = (DigestNotificationSettingsJSON::jsonb - 'disable_weekly_digest')::json;
