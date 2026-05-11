// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestNewMarotoRenderer asserts the constructor returns a non-nil renderer.
// Phase A1 stage: fonts may be empty (Phase A2 adds the .ttf bytes), but
// construction itself must succeed.
func TestNewMarotoRenderer(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)
	require.NotNil(t, r)
}

// TestRenderRun_EmptyContext exercises the full section pipeline with an
// empty RenderContext. The renderer must return a valid PDF buffer — every
// section function handles zero-value input gracefully.
func TestRenderRun_EmptyContext(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	buf, err := r.RenderRun(context.Background(), RenderContext{}, RenderOptions{
		Sections: DefaultRunSections(),
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 0)
	require.True(t, bytes.HasPrefix(buf.Bytes(), []byte("%PDF-")), "output must start with PDF magic")
}

// TestRenderPlaybook_EmptyContext is the playbook-surface counterpart.
func TestRenderPlaybook_EmptyContext(t *testing.T) {
	r, err := NewMarotoRenderer()
	require.NoError(t, err)

	buf, err := r.RenderPlaybook(context.Background(), PlaybookRenderContext{}, RenderOptions{
		Sections: DefaultPlaybookSections(),
		Locale:   "en",
	})
	require.NoError(t, err)
	require.NotNil(t, buf)
	require.Greater(t, buf.Len(), 0)
	require.True(t, bytes.HasPrefix(buf.Bytes(), []byte("%PDF-")), "output must start with PDF magic")
}


// TestDefaultRunSections_TranscriptOffByDefault locks in the "transcript
// off by default" decision (spec.md AC implication; plan §10 round-1 #3).
func TestDefaultRunSections_TranscriptOffByDefault(t *testing.T) {
	s := DefaultRunSections()
	require.False(t, s.Transcript, "default run sections must not include transcript (privacy default)")
	require.True(t, s.Cover)
	require.True(t, s.ExecutiveSummary)
	require.True(t, s.Timeline)
	require.True(t, s.StatusUpdates)
	require.True(t, s.Checklists)
	require.True(t, s.Retrospective)
}

// TestRenderOptions_ClockInjection asserts the Clock func injection works
// for deterministic golden tests. Defaults to time.Now when nil.
func TestRenderOptions_ClockInjection(t *testing.T) {
	const fixed int64 = 1_700_000_000_000

	opts := RenderOptions{Clock: func() int64 { return fixed }}
	require.Equal(t, fixed, opts.now())

	// Nil clock falls back to wall-clock; assert it produces a sane recent value.
	opts.Clock = nil
	got := opts.now()
	require.Greater(t, got, int64(1_500_000_000_000), "default clock should return a recent ms timestamp")
}
