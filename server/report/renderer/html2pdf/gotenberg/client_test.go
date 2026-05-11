// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gotenberg

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/report/renderer/html2pdf"
)

func TestClientImplementsInterface(t *testing.T) {
	var _ html2pdf.HTMLPdfRenderer = (*Client)(nil)
}

func TestClientNameAndCapabilities(t *testing.T) {
	c := New(Config{BaseURL: "http://example.invalid"})
	require.Equal(t, "gotenberg", c.Name())

	caps := c.Capabilities()
	require.True(t, caps.SupportsLinks)
	require.ElementsMatch(t, []string{"PDF/A-1a", "PDF/A-2b", "PDF/A-3b"}, caps.SupportsPDFA)
	require.Zero(t, caps.MaxPageCount)
}

func TestClientRenderNotImplemented(t *testing.T) {
	c := New(Config{BaseURL: "http://example.invalid"})
	out, err := c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{})
	require.Error(t, err)
	require.Nil(t, out)
}

func TestHealthCheckMissingBaseURL(t *testing.T) {
	c := New(Config{})
	err := c.HealthCheck(context.Background())
	require.Error(t, err)
	require.Contains(t, err.Error(), "BaseURL")
}

func TestHealthCheckOK(t *testing.T) {
	var sawAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/health", r.URL.Path)
		sawAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL, AuthHeader: "Bearer xyz"})
	require.NoError(t, c.HealthCheck(context.Background()))
	require.Equal(t, "Bearer xyz", sawAuth)
}

func TestHealthCheckNon200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	err := c.HealthCheck(context.Background())
	require.Error(t, err)
	require.Contains(t, err.Error(), "503")
}
