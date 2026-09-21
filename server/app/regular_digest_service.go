// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"time"
	"unicode/utf8"
)

// digestMaxItems is the maximum number of items shown per digest section for
// scheduled digests (force=false). When a section exceeds this limit a
// "…and N more" footer is appended instead of the remaining items.
// /playbook todo (force=true) passes maxItems=0 (uncapped); capDigestMessage
// remains the size safety net for both paths.
// When capDigestMessage truncates, per-section "…and N more" footers may be
// discarded and replaced by the generic truncation footer linking to /playbooks/runs.
const digestMaxItems = 20

// capDigestMessage returns message unchanged when it fits within maxRunes.
// When message exceeds maxRunes, it is truncated to leave room for footer,
// snapping back to the last newline so no markdown link is cut mid-syntax,
// then footer is appended. Precondition: footer must be shorter than maxRunes.
func capDigestMessage(message, footer string, maxRunes int) string {
	if utf8.RuneCountInString(message) <= maxRunes {
		return message
	}
	budget := max(0, maxRunes-utf8.RuneCountInString(footer))
	truncated := truncateRunes(message, budget)
	if i := strings.LastIndex(truncated, "\n"); i > 0 {
		truncated = truncated[:i]
	}
	return truncated + footer
}

func ShouldSendWeeklyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	if userInfo.DigestNotificationSettings.DisableWeeklyDigest {
		return false
	}

	lastSentTime := time.UnixMilli(userInfo.LastDailyTodoDMAt).In(timezone)

	currentYear, currentWeek := currentTime.ISOWeek()
	lastSentYear, lastSentWeek := lastSentTime.ISOWeek()
	isFirstLoginOfTheWeek := currentYear != lastSentYear || currentWeek != lastSentWeek

	return isFirstLoginOfTheWeek
}

func ShouldSendDailyDigestMessage(userInfo UserInfo, timezone *time.Location, currentTime time.Time) bool {
	if userInfo.DigestNotificationSettings.DisableDailyDigest {
		return false
	}
	// DM message if it's the next day and been more than an hour since the last post
	// Hat tip to Github plugin for the logic.
	lastSentTime := time.UnixMilli(userInfo.LastDailyTodoDMAt).In(timezone)

	isMoreThanOneHourPassed := currentTime.Sub(lastSentTime).Hours() >= 1

	isDifferentDay := currentTime.Day() != lastSentTime.Day() ||
		currentTime.Month() != lastSentTime.Month() ||
		currentTime.Year() != lastSentTime.Year()

	return isMoreThanOneHourPassed && isDifferentDay
}
