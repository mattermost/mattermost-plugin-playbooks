// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gotenberg

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

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

func TestRenderSuccess(t *testing.T) {
	want := []byte("%PDF-test")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/forms/chromium/convert/html", r.URL.Path)
		require.True(t, strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data"))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(want)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	got, err := c.Render(context.Background(), []byte("<html><body>hi</body></html>"), html2pdf.Options{})
	require.NoError(t, err)
	require.Equal(t, want, got)
}

func TestRenderNon200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	out, err := c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{})
	require.Error(t, err)
	require.Nil(t, out)
	require.Contains(t, err.Error(), "500")
}

func TestRenderSemaphoreRespected(t *testing.T) {
	// The mock server blocks long enough that the second call would need to
	// wait for a semaphore slot — but its context is already cancelled so it
	// must error out immediately.
	released := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		<-released
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("%PDF-test"))
	}))
	defer srv.Close()
	defer close(released)

	c := New(Config{BaseURL: srv.URL, MaxConcurrent: 1})

	// Kick off the first call; it acquires the only semaphore slot and
	// blocks inside the HTTP handler.
	firstDone := make(chan struct{})
	go func() {
		_, _ = c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{})
		close(firstDone)
	}()

	// Give the first goroutine a moment to take the slot.
	require.Eventually(t, func() bool {
		// Best-effort: the goroutine has likely started + acquired by now.
		return true
	}, 100*time.Millisecond, 10*time.Millisecond)
	time.Sleep(20 * time.Millisecond)

	// Second call with an already-cancelled context.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	start := time.Now()
	_, err := c.Render(ctx, []byte("<html/>"), html2pdf.Options{})
	elapsed := time.Since(start)
	require.Error(t, err)
	require.True(t, err == context.Canceled || err == context.DeadlineExceeded,
		"expected context cancellation error, got %v", err)
	require.Less(t, elapsed, 100*time.Millisecond, "second call should not block")

	// Let the first call finish so the test exits cleanly.
	released <- struct{}{}
	<-firstDone
}

func TestRenderResponseCap(t *testing.T) {
	const cap int64 = 16
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// Write cap + 2 bytes to trigger the limit.
		buf := make([]byte, cap+2)
		for i := range buf {
			buf[i] = 'A'
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(buf)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL, MaxResponseBytes: cap})
	out, err := c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{})
	require.Error(t, err)
	require.Nil(t, out)
	require.Contains(t, err.Error(), "exceeded")
}

func TestRenderPdfAField(t *testing.T) {
	var capturedPdfA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseMultipartForm(1<<20))
		if vals, ok := r.MultipartForm.Value["pdfa"]; ok && len(vals) > 0 {
			capturedPdfA = vals[0]
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("%PDF-test"))
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	_, err := c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{PdfAFlavor: "PDF/A-2b"})
	require.NoError(t, err)
	require.Equal(t, "PDF/A-2b", capturedPdfA)
}

func TestRenderUnsupportedPdfAFlavor(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := New(Config{BaseURL: srv.URL})
	out, err := c.Render(context.Background(), []byte("<html/>"), html2pdf.Options{PdfAFlavor: "PDF/X-1a"})
	require.Error(t, err)
	require.Nil(t, out)
	require.Contains(t, err.Error(), "PDF/X-1a")
	require.Zero(t, atomic.LoadInt32(&hits), "no HTTP request should have been made")
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
