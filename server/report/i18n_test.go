// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewLabels_DefaultsToEnglish(t *testing.T) {
	l := NewLabels("")
	require.Equal(t, "en", l.Locale())
}

func TestLabels_UnknownLocaleKeepsCode(t *testing.T) {
	l := NewLabels("xx-XX")
	require.Equal(t, "xx-XX", l.Locale())
	require.Equal(t, "Owner", l.Owner())
}

func TestLabels_TaskState(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "Done", l.TaskState("Closed"))
	require.Equal(t, "Skipped", l.TaskState("Skipped"))
	require.Equal(t, "In progress", l.TaskState("InProgress"))
	require.Equal(t, "Open", l.TaskState(""))
	require.Equal(t, "Custom", l.TaskState("Custom"))
}

func TestLabels_StatusDisplay(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "In progress", l.StatusDisplay("InProgress"))
	require.Equal(t, "Finished", l.StatusDisplay("Finished"))
	require.Equal(t, "Other", l.StatusDisplay("Other"))
}

func TestLabels_Page(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "Page 3 of 7", l.Page(3, 7))
}

func TestLabels_TranscriptTruncated(t *testing.T) {
	l := NewLabels("en")
	require.Contains(t, l.TranscriptTruncated("posts", 100), "100 posts")
	require.Contains(t, l.TranscriptTruncated("bytes", 42), "42 posts")
	require.Equal(t, "Transcript truncated.", l.TranscriptTruncated("", 0))
}

func TestLabels_FormatDate(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "Not set", l.FormatDate(0))
	require.Equal(t, "Not set", l.FormatDate(-1))
	require.Equal(t, "2023-11-14 22:13 UTC", l.FormatDate(1_700_000_000_000))
}

func TestLabels_FormatDuration(t *testing.T) {
	l := NewLabels("en")
	require.Equal(t, "Not set", l.FormatDuration(0))

	const minute = int64(60 * 1000)
	const hour = 60 * minute
	const day = 24 * hour

	require.Equal(t, "5m", l.FormatDuration(5*minute))
	require.Equal(t, "0m", l.FormatDuration(30*1000))
	require.Equal(t, "1h 30m", l.FormatDuration(hour+30*minute))
	require.Equal(t, "2d 3h 4m", l.FormatDuration(2*day+3*hour+4*minute))
}
