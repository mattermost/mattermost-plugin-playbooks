// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package html2pdf

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// fakeRenderer is a compile-time assertion that the HTMLPdfRenderer
// interface is satisfiable and stable.
type fakeRenderer struct{}

func (fakeRenderer) Name() string { return "fake" }
func (fakeRenderer) Capabilities() Capabilities {
	return Capabilities{SupportsLinks: true}
}
func (fakeRenderer) Render(_ context.Context, _ []byte, _ Options) ([]byte, error) {
	return []byte("%PDF-1.4\n"), nil
}
func (fakeRenderer) HealthCheck(_ context.Context) error { return nil }

func TestHTMLPdfRendererInterface(t *testing.T) {
	var r HTMLPdfRenderer = fakeRenderer{}
	require.Equal(t, "fake", r.Name())

	caps := r.Capabilities()
	require.True(t, caps.SupportsLinks)
	require.Empty(t, caps.SupportsPDFA)
	require.Zero(t, caps.MaxPageCount)

	out, err := r.Render(context.Background(), []byte("<html/>"), Options{
		Title:       "t",
		Filename:    "t.pdf",
		EnableLinks: true,
		PageSize:    "A4",
	})
	require.NoError(t, err)
	require.NotEmpty(t, out)

	require.NoError(t, r.HealthCheck(context.Background()))
}
