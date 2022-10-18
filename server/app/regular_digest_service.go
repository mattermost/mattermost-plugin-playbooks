package app

import (
	"time"

	"github.com/mattermost/mattermost-plugin-playbooks/server/timeutils"
)

func ShouldSendWeeklyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	lastSentTime := timeutils.GetUnixTimeForTimezone(userInfo.LastDailyTodoDMAt, timezone)

	currentYear, currentWeek := currentTime.ISOWeek()
	lastSentYear, lastSentWeek := lastSentTime.ISOWeek()
	isFirstLoginOfTheWeek := currentYear != lastSentYear || currentWeek != lastSentWeek

	return ShouldSendDailyDigestMessage(userInfo, timezone, currentTime) && isFirstLoginOfTheWeek
}

func ShouldSendDailyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	// DM message if it's the next day and been more than an hour since the last post
	// Hat tip to Github plugin for the logic.
	lastSentTime := timeutils.GetUnixTimeForTimezone(userInfo.LastDailyTodoDMAt, timezone)

	isMoreThanOneHourPassed := currentTime.Sub(lastSentTime).Hours() >= 1

	isDifferentDay := currentTime.Day() != lastSentTime.Day() ||
		currentTime.Month() != lastSentTime.Month() ||
		currentTime.Year() != lastSentTime.Year()

	return isMoreThanOneHourPassed && isDifferentDay
}