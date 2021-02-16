// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/*
Package client provides a client for using the Workflows API.

Usage:
	import ir "github.com/mattermost/mattermost-plugin-incident-collaboration/client"

Construct a new Workflows client, then use the various services on the client to
access different parts of the workflows API. For example:

	client, err := ir.NewClient("http://localhost:8065", nil)
	if err != nil {
		log.Fatal(err)
	}

	// list all incidents
	list, err := client.Incidents.List(context.Background(), ir.IncidentListOptions{})

Some API methods have optional parameters that can be passed. For example:

	client, err := ir.NewClient("http://localhost:8065", nil)
	if err != nil {
		log.Fatal(err)
	}

	// list incidents by status
	list, err := client.Incidents.List(context.Background(), ir.IncidentListOptions{
		Sort: ir.ByIsActive,
	})

Using the https://godoc.org/context package, one can easily
pass cancelation signals and deadlines to various services of the client for
handling a request. In case there is no context available, then context.Background()
can be used as a starting point.

Authentication

The workflows client does not directly handle authentication. Instead, when
creating a new client, pass an http.Client that can handle authentication for
you. The easiest and recommended way to do this is using the golang.org/x/oauth2
library, but you can always use any other library that provides an http.Client.
If you have an OAuth2 access token (for example, a personal API token as per https://docs.mattermost.com/developer/personal-access-tokens.html),
you can use it with the oauth2 library using:

	import (
		ir "github.com/mattermost/mattermost-plugin-incident-collaboration/client"
		"golang.org/x/oauth2"
	)

	func main() {
		ctx := context.Background()
		ts := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: "<your-access-token>"},
		)
		tc := oauth2.NewClient(ctx, ts)

		client, err := ir.NewClient("http://localhost:8065", tc)
		if err != nil {
			log.Fatal(err)
		}

		// list all incidents for the authenticated user
		list, err := client.Incidents.List(context.Background(), ir.IncidentListOptions{})
	}

Note that when using an authenticated Client, all calls made by the client will
include the specified OAuth token. Therefore, authenticated clients should
almost never be shared between different users.

See the oauth2 docs for complete instructions on using that library.

Pagination

All requests for resource collections (incidents, playbooks, etc.)
support pagination. Pagination options are described in the
ir.ListOptions struct and passed to the list methods directly or as an
embedded type of a more specific list options struct (for example
ir.IncidentListOptions). Pages information is available via the
ir.ListResult struct.

	client, err := ir.NewClient("http://localhost:8065", nil)
	if err != nil {
		log.Fatal(err)
	}

	var allIncidents []*ir.Incident
	for page := 0; ; page++ {
		list, err := client.Incidents.List(context.Background(), ir.IncidentListOptions{
			ListOptions: ir.ListOptions{Page: page, PerPage: 15},
		})
		if err != nil {
			return nil, err
		}

		allIncidents = append(allIncidents, list.Items...)
		if !list.HasMore {
			break
		}
	}

*/
package client
