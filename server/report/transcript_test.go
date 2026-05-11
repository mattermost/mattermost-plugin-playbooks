// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGroupByThread_PreservesRootThenReplies(t *testing.T) {
	posts := []RenderPost{
		{PostID: "root1", CreateAt: 1, Message: "hi"},
		{PostID: "r1", RootID: "root1", CreateAt: 2, Message: "reply 1"},
		{PostID: "root2", CreateAt: 3, Message: "second thread"},
		{PostID: "r2", RootID: "root1", CreateAt: 4, Message: "reply 2"},
	}
	groups := groupByThread(posts)
	require.Len(t, groups, 2)
	require.Equal(t, "root1", groups[0][0].PostID)
	require.Equal(t, "r1", groups[0][1].PostID)
	require.Equal(t, "r2", groups[0][2].PostID)
	require.Equal(t, "root2", groups[1][0].PostID)
}

func TestGroupByThread_OrphanReplyPromoted(t *testing.T) {
	posts := []RenderPost{
		{PostID: "r1", RootID: "missing", CreateAt: 1, Message: "stray"},
	}
	groups := groupByThread(posts)
	require.Len(t, groups, 1)
	require.Equal(t, "r1", groups[0][0].PostID)
}

func TestRenderRun_TranscriptNonMemberSentinel(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	rc := sampleRunContext()
	rc.Transcript = nil

	buf, err := r.RenderRun(context.Background(), rc, RenderOptions{
		Sections: SectionFlags{Cover: true, Transcript: true},
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Equal(t, []byte("%PDF"), buf.Bytes()[:4])
}

func TestRenderRun_TranscriptWithPosts(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	rc := sampleRunContext()
	rc.Transcript = []RenderPost{
		{PostID: "root1", AuthorID: "u1", CreateAt: 1_700_000_010_000, Message: "Starting investigation."},
		{PostID: "reply1", RootID: "root1", AuthorID: "u1", CreateAt: 1_700_000_020_000, Message: "Found the root cause."},
		{PostID: "root2", AuthorID: "u1", CreateAt: 1_700_000_030_000, Message: "All clear."},
	}

	buf, err := r.RenderRun(context.Background(), rc, RenderOptions{
		Sections: SectionFlags{Cover: true, Transcript: true},
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 100)
}

func TestRenderRun_TranscriptTruncationMarkerRendered(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	rc := sampleRunContext()
	rc.Transcript = []RenderPost{
		{PostID: "root1", AuthorID: "u1", CreateAt: 1_700_000_010_000, Message: "One."},
	}
	rc.TranscriptTruncation = Truncation{Hit: true, Reason: "posts", Posts: 1}

	buf, err := r.RenderRun(context.Background(), rc, RenderOptions{
		Sections: SectionFlags{Cover: true, Transcript: true},
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
}
