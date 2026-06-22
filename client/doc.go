// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package client provides an HTTP client for using the Playbooks API.
//
// External callers authenticate as a Mattermost user and construct a client with New:
//
//	pb, err := client.New(client4)
//
// Other plugins can reach the Playbooks API over inter-plugin HTTP with
// NewInterPluginClient, acting on behalf of a given user. Requests are dispatched through the
// caller's PluginHTTP entrypoint and authorized with that user's permissions:
//
//	pb, err := client.NewInterPluginClient(p.API.PluginHTTP, userID)
//	if err != nil {
//	    return err
//	}
//	run, err := pb.PlaybookRuns.Get(ctx, runID)
//
// This requires the Playbooks server to honor the acting-user header, so it returns 401 against
// servers that predate that support.
package client
