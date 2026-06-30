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
	// RoundTrip must not modify the original request, so operate on a clone. The clone shares the
	// original's Body, so closing it below also discharges RoundTrip's duty to close req.Body.
	outReq := req.Clone(req.Context())
	outReq.Header.Set(actingUserIDHeader, t.actingUserID)

	// RoundTrip must always close the request body. PluginHTTP's buffered path closes and nils the
	// body itself, but its streaming path does not, so close whatever remains once the call returns.
	defer func() {
		if outReq.Body != nil {
			outReq.Body.Close()
		}
	}()

	resp := t.do(outReq)
	if resp == nil {
		return nil, errors.Errorf("no response from the %s plugin; is it installed and enabled?", manifestID)
	}

	// PluginHTTP does not populate Response.Request, but the client dereferences it when building
	// error responses for non-2xx replies. Set it as net/http's Transport does for real network
	// requests, so a non-2xx response yields an error rather than a nil-pointer panic.
	if resp.Request == nil {
		resp.Request = outReq
	}

	return resp, nil
}
