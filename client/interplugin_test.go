// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client_test

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

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
}
