// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client_test

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

func TestNewInterPluginClient(t *testing.T) {
	noopDo := func(*http.Request) *http.Response { return nil }

	t.Run("requires a PluginHTTP function", func(t *testing.T) {
		c, err := client.NewInterPluginClient(nil, "user_abc")
		require.Error(t, err)
		require.Nil(t, c)
	})

	t.Run("requires an acting user ID", func(t *testing.T) {
		c, err := client.NewInterPluginClient(noopDo, "")
		require.Error(t, err)
		require.Nil(t, c)
	})

	t.Run("routes through PluginHTTP and asserts the acting user", func(t *testing.T) {
		var gotReq *http.Request
		do := func(req *http.Request) *http.Response {
			gotReq = req
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"id":"run123"}`)),
			}
		}

		c, err := client.NewInterPluginClient(do, "user_abc")
		require.NoError(t, err)

		run, err := c.PlaybookRuns.Get(context.Background(), "run123")
		require.NoError(t, err)
		require.Equal(t, "run123", run.ID)

		// The path must be /<pluginid>/api/v0/... so PluginHTTP routes it to Playbooks.
		require.Equal(t, "/playbooks/api/v0/runs/run123", gotReq.URL.Path)
		require.Equal(t, "user_abc", gotReq.Header.Get("Mattermost-Plugin-Acting-User-Id"))
	})

	t.Run("non-2xx response is returned as an error, not a panic", func(t *testing.T) {
		// PluginHTTP leaves Response.Request nil; the transport must set it so checkResponse
		// does not dereference a nil pointer when building the error for a non-2xx reply.
		do := func(*http.Request) *http.Response {
			return &http.Response{
				StatusCode: http.StatusForbidden,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"forbidden"}`)),
			}
		}

		c, err := client.NewInterPluginClient(do, "user_abc")
		require.NoError(t, err)

		_, err = c.PlaybookRuns.Get(context.Background(), "run123")
		require.Error(t, err)
	})

	t.Run("surfaces a nil response as an error", func(t *testing.T) {
		c, err := client.NewInterPluginClient(noopDo, "user_abc")
		require.NoError(t, err)

		_, err = c.PlaybookRuns.Get(context.Background(), "run123")
		require.Error(t, err)
	})

	t.Run("closes a body-bearing request on the success path", func(t *testing.T) {
		// Create sends a JSON-encoded body, unlike the other subtests' bodyless GETs, so this is
		// the one that exercises the goroutine's outReq.Body.Close() under the race detector.
		var gotBody []byte
		closed := make(chan struct{})
		do := func(req *http.Request) *http.Response {
			req.Body = &closeTrackingReadCloser{ReadCloser: req.Body, closed: closed}
			gotBody, _ = io.ReadAll(req.Body)
			return &http.Response{
				StatusCode: http.StatusCreated,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"id":"run123"}`)),
			}
		}

		c, err := client.NewInterPluginClient(do, "user_abc")
		require.NoError(t, err)

		run, err := c.PlaybookRuns.Create(context.Background(), client.PlaybookRunCreateOptions{Name: "test run"})
		require.NoError(t, err)
		require.Equal(t, "run123", run.ID)
		require.Contains(t, string(gotBody), "test run")

		select {
		case <-closed:
		case <-time.After(time.Second):
			t.Fatal("RoundTrip did not close the request body")
		}
	})

	t.Run("returns immediately without invoking PluginHTTP when the context is already canceled", func(t *testing.T) {
		called := false
		do := func(*http.Request) *http.Response {
			called = true
			return nil
		}

		c, err := client.NewInterPluginClient(do, "user_abc")
		require.NoError(t, err)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		_, err = c.PlaybookRuns.Get(ctx, "run123")
		require.Error(t, err)
		require.True(t, errors.Is(err, context.Canceled))
		require.False(t, called)
	})

	t.Run("returns promptly when the context expires mid-call, instead of blocking", func(t *testing.T) {
		started := make(chan struct{})
		release := make(chan struct{})
		respBodyClosed := make(chan struct{})

		do := func(*http.Request) *http.Response {
			close(started)
			<-release
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       &closeTrackingReadCloser{ReadCloser: io.NopCloser(strings.NewReader(`{"id":"run123"}`)), closed: respBodyClosed},
			}
		}

		c, err := client.NewInterPluginClient(do, "user_abc")
		require.NoError(t, err)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
		defer cancel()

		// Run Get on its own goroutine and bound every wait below: if a regression ever made
		// RoundTrip stop honoring ctx, this test fails fast with a clear message instead of
		// hanging until the suite's global timeout.
		getErr := make(chan error, 1)
		go func() {
			_, err := c.PlaybookRuns.Get(ctx, "run123")
			getErr <- err
		}()

		// Confirm PluginHTTP actually entered its blocking call before judging Get's behavior, so
		// this proves the context wins a real race against an in-flight call, not that the handler
		// simply never ran.
		select {
		case <-started:
		case <-time.After(time.Second):
			close(release)
			t.Fatal("PluginHTTP was never invoked")
		}

		select {
		case err := <-getErr:
			require.Error(t, err)
			require.True(t, errors.Is(err, context.DeadlineExceeded))
		case <-time.After(time.Second):
			close(release)
			t.Fatal("Get did not return promptly once its context expired")
		}

		// The call above only abandons the in-flight PluginHTTP call; it keeps running underneath.
		// Release it and confirm its late response body still gets closed instead of leaking.
		close(release)
		select {
		case <-respBodyClosed:
		case <-time.After(time.Second):
			t.Fatal("late response body was never closed")
		}
	})
}

// closeTrackingReadCloser wraps an io.ReadCloser and signals closed when Close is called, so tests
// can assert that a body was actually closed rather than just read.
type closeTrackingReadCloser struct {
	io.ReadCloser
	closed chan struct{}
}

func (c *closeTrackingReadCloser) Close() error {
	err := c.ReadCloser.Close()
	close(c.closed)
	return err
}
