// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCapDigestMessage(t *testing.T) {
	const footer = "\nfooter"
	const maxRunes = 20

	t.Run("under limit returns unchanged", func(t *testing.T) {
		msg := "hello world"
		assert.Equal(t, msg, capDigestMessage(msg, footer, maxRunes))
	})

	t.Run("over limit truncates and appends footer", func(t *testing.T) {
		// 30 runes of content, exceeds maxRunes=20
		msg := "line1\nline2\nline3\nline4\nline5\n"
		got := capDigestMessage(msg, footer, maxRunes)
		assert.LessOrEqual(t, utf8.RuneCountInString(got), maxRunes)
		assert.True(t, strings.HasSuffix(got, footer), "result should end with footer, got %q", got)
		assert.True(t, strings.HasPrefix(got, "line1\n"), "result should begin with preserved content, got %q", got)
	})

	t.Run("snaps to last newline, no partial link", func(t *testing.T) {
		// Craft a message where a naive byte-cut would land inside [link](url)
		// maxRunes=20, footer=7 runes => budget=13
		link := "[see run](http://example.com/very-long-url)"
		msg := "line1\nline2\n" + link
		got := capDigestMessage(msg, footer, maxRunes)
		assert.False(t, strings.Contains(got, "[see") && !strings.Contains(got, "[see run]("), "result contains a partial markdown link: %q", got)
		assert.True(t, strings.HasSuffix(got, footer), "result should end with footer, got %q", got)
	})

	t.Run("multi-byte content respects rune boundary", func(t *testing.T) {
		// Each emoji is 1 rune but 4 bytes; naive byte-slice would panic.
		// 11 × (emoji + newline) = 22 runes, which exceeds maxRunes=20.
		msg := "🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n🔥\n"
		got := capDigestMessage(msg, footer, maxRunes)
		assert.LessOrEqual(t, utf8.RuneCountInString(got), maxRunes)
		assert.True(t, strings.HasSuffix(got, footer), "result should end with footer, got %q", got)
	})

	t.Run("exactly at limit returns unchanged", func(t *testing.T) {
		msg := strings.Repeat("a", maxRunes)
		assert.Equal(t, msg, capDigestMessage(msg, footer, maxRunes))
	})
}

func TestDigestItemCap(t *testing.T) {
	makeRunLinks := func(n int) []RunLink {
		runs := make([]RunLink, n)
		for i := range runs {
			runs[i] = RunLink{PlaybookRunID: fmt.Sprintf("run-%d", i), Name: fmt.Sprintf("Run %d", i)}
		}
		return runs
	}

	makeAssignedRuns := func(tasksPerRun, numRuns int, dueDate int64) []AssignedRun {
		runs := make([]AssignedRun, numRuns)
		for i := range runs {
			runs[i] = AssignedRun{
				RunLink: RunLink{PlaybookRunID: fmt.Sprintf("run-%d", i), Name: fmt.Sprintf("Run %d", i)},
			}
			for j := 0; j < tasksPerRun; j++ {
				runs[i].Tasks = append(runs[i].Tasks, AssignedTask{
					ChecklistTitle: "Checklist",
					ChecklistItem:  ChecklistItem{Title: fmt.Sprintf("Task %d-%d", i, j), DueDate: dueDate},
				})
			}
		}
		return runs
	}

	t.Run("buildRunsInProgressMessage caps at digestMaxItems", func(t *testing.T) {
		runs := makeRunLinks(digestMaxItems + 5)
		msg := buildRunsInProgressMessage(runs, "en")
		// In the test environment i18n returns the key; check the key is present.
		assert.Equal(t, digestMaxItems, strings.Count(msg, "- [Run"))
		assert.Contains(t, msg, "app.user.digest.more_runs")
	})

	t.Run("buildRunsInProgressMessage under cap shows all", func(t *testing.T) {
		runs := makeRunLinks(3)
		msg := buildRunsInProgressMessage(runs, "en")
		assert.Equal(t, 3, strings.Count(msg, "- [Run"))
		assert.NotContains(t, msg, "app.user.digest.more_runs")
	})

	t.Run("buildRunsOverdueMessage caps at digestMaxItems", func(t *testing.T) {
		runs := makeRunLinks(digestMaxItems + 3)
		msg := buildRunsOverdueMessage(runs, "en")
		assert.Equal(t, digestMaxItems, strings.Count(msg, "- [Run"))
		assert.Contains(t, msg, "app.user.digest.more_runs")
	})

	t.Run("buildAssignedTaskMessageSummary caps displayed tasks at digestMaxItems", func(t *testing.T) {
		// 3 runs × 9 tasks each = 27 tasks; all have a due date so all are displayable.
		// Due date = 0 (no due date) is excluded in onlyTasksDueUntilToday mode.
		// Use dueDate=1 (effectively epoch, well in the past) so tasks are treated as overdue.
		runs := makeAssignedRuns(9, 3, 1)
		msg := buildAssignedTaskMessageSummary(runs, "en", time.UTC, false)
		taskLineCount := strings.Count(msg, "  - [ ]")
		require.Equal(t, digestMaxItems, taskLineCount, "should display exactly digestMaxItems task lines")
		assert.Contains(t, msg, "app.user.digest.more_tasks", "should have more_tasks footer when over cap")
	})

	t.Run("buildAssignedTaskMessageSummary under cap shows all tasks", func(t *testing.T) {
		runs := makeAssignedRuns(3, 2, 1) // 6 tasks total — under cap
		msg := buildAssignedTaskMessageSummary(runs, "en", time.UTC, false)
		taskLineCount := strings.Count(msg, "  - [ ]")
		assert.Equal(t, 6, taskLineCount)
		assert.NotContains(t, msg, "app.user.digest.more_tasks")
	})
}

func TestShouldSendWeeklyDigestMessage(t *testing.T) {
	now, ok := time.Parse("2006-01-02", "2022-10-08")
	if ok != nil {
		t.Error("Could not parse current time")
	}

	type args struct {
		userInfo    UserInfo
		timezone    *time.Location
		currentTime time.Time
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "Should not send a weekly digest if the user has configured it so",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -6).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableWeeklyDigest: true,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should not send a weekly digest if we have already sent a digest this week",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -1).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should send a weekly digest if we have not sent a digest this week",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.AddDate(0, 0, -6).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
		{
			name: "Should send a weekly digest if we have not sent a digest ever",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: 0,
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest:  false,
						DisableWeeklyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldSendWeeklyDigestMessage(tt.args.userInfo, tt.args.timezone, tt.args.currentTime); got != tt.want {
				t.Errorf("ShouldSendWeeklyDigestMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestShouldSendDailyDigestMessage(t *testing.T) {
	now, ok := time.Parse("Jan 2, 2006 at 3:04pm", "Oct 8, 2022 at 3:04pm")
	lateNow, lateOk := time.Parse("Jan 2, 2006 at 3:04pm", "Oct 8, 2022 at 12:10am")
	if ok != nil || lateOk != nil {
		t.Error("Could not parse current time")
	}

	type args struct {
		userInfo    UserInfo
		timezone    *time.Location
		currentTime time.Time
	}
	tests := []struct {
		name string
		args args
		want bool
	}{
		{
			name: "Should not send a daily digest if we have already sent a digest today",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.Add(-((time.Hour * 1) + (time.Minute * 2))).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: false,
		},
		{
			name: "Should send a daily digest if we have not sent a digest today",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: now.Add(-(time.Hour * 25)).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: now,
			},
			want: true,
		},
		{
			name: "Should not send a daily digest if we have sent one within the last hour",
			args: args{
				userInfo: UserInfo{
					ID:                "testUser",
					LastDailyTodoDMAt: lateNow.Add(-(time.Minute * 40)).UnixMilli(),
					DigestNotificationSettings: DigestNotificationSettings{
						DisableDailyDigest: false,
					},
				},
				timezone:    time.FixedZone("local", 0),
				currentTime: lateNow,
			},
			want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ShouldSendDailyDigestMessage(tt.args.userInfo, tt.args.timezone, tt.args.currentTime); got != tt.want {
				t.Errorf("ShouldSendDailyDigestMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}
