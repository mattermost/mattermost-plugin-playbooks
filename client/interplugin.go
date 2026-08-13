// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"net/http"

	"github.com/pkg/errors"
)

// actingUserIDHeader names the user a calling plugin is acting on behalf of. The Playbooks server
// promotes it into the authenticated user for trusted inter-plugin requests, so the request is
// authorized with that user's permissions.
const actingUserIDHeader = "Mattermost-Plugin-Acting-User-Id"

// PluginHTTPFunc performs an inter-plugin HTTP request. It matches the signature of both
// pluginapi.Client's Plugin.HTTP method and plugin.API's PluginHTTP method, so a caller can pass
// either without this package depending on them.
type PluginHTTPFunc func(*http.Request) *http.Response

// NewInterPluginClient creates a Client that reaches the Playbooks plugin over inter-plugin HTTP,
// acting on behalf of the given user. Every request is authorized with that user's permissions, so
// the client only ever sees what actingUserID is allowed to see.
//
// do is the calling plugin's inter-plugin HTTP entrypoint, e.g. pluginAPI.Plugin.HTTP or
// API.PluginHTTP. Example:
//
//	pb, err := client.NewInterPluginClient(p.API.PluginHTTP, userID)
//	if err != nil {
//	    return err
//	}
//	run, err := pb.PlaybookRuns.Get(ctx, runID)
func NewInterPluginClient(do PluginHTTPFunc, actingUserID string) (*Client, error) {
	if do == nil {
		return nil, errors.New("a PluginHTTP function is required")
	}
	if actingUserID == "" {
		return nil, errors.New("an acting user ID is required")
	}

	httpClient := &http.Client{
		Transport: &interPluginTransport{do: do, actingUserID: actingUserID},
	}

	// The host is irrelevant: PluginHTTP routes by the request path's first segment, which is
	// supplied by interPluginAPIURLPrefix. Only a syntactically valid base URL is needed.
	c, err := newClient("http://playbooks.local", httpClient)
	if err != nil {
		return nil, err
	}
	c.apiURLPrefix = interPluginAPIURLPrefix

	return c, nil
}

// interPluginTransport is an http.RoundTripper that dispatches requests through the calling
// plugin's inter-plugin HTTP entrypoint, asserting the acting user on each request.
type interPluginTransport struct {
	do           PluginHTTPFunc
	actingUserID string
}

func (t *interPluginTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx := req.Context()

	// RoundTrip must not modify the original request, so operate on a clone. The clone shares the
	// original's Body, so closing it below also discharges RoundTrip's duty to close req.Body.
	outReq := req.Clone(ctx)
	outReq.Header.Set(actingUserIDHeader, t.actingUserID)

	// PluginHTTP is a synchronous in-process call that never looks at ctx, so it cannot be
	// interrupted directly. Run it on a goroutine and race it against ctx.Done() so a canceled or
	// timed-out context still lets RoundTrip return promptly, instead of blocking forever. This
	// cannot abort the calling plugin's handler, which keeps running to completion regardless; it
	// only stops this method from waiting on it.
	//
	// The goroutine owns outReq for its entire lifetime, including closing its body: RoundTrip may
	// return on the ctx path while t.do is still running, so nothing on this side of the select may
	// touch outReq after starting the goroutine.
	respCh := make(chan *http.Response, 1)
	go func() {
		// RoundTrip must always close the request body. PluginHTTP's buffered path closes and nils
		// the body itself, but its streaming path does not, so close whatever remains.
		defer func() {
			if outReq.Body != nil {
				outReq.Body.Close()
			}
		}()
		respCh <- t.do(outReq)
	}()

	select {
	case <-ctx.Done():
		// The goroutine above is abandoned: it keeps running PluginHTTP to completion and, on
		// success, its response body is never closed. That's an accepted leak on the cancellation
		// path, not something this layer can fix without PluginHTTP itself observing a context.
		return nil, ctx.Err()
	case resp := <-respCh:
		if resp == nil {
			return nil, errors.Errorf("no response from the %s plugin; is it installed and enabled?", manifestID)
		}

		// PluginHTTP does not populate Response.Request, but the client dereferences it when
		// building error responses for non-2xx replies. Set it as net/http's Transport does for
		// real network requests, so a non-2xx response yields an error rather than a nil-pointer
		// panic.
		if resp.Request == nil {
			resp.Request = outReq
		}

		return resp, nil
	}
}
