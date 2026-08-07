// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"context"
	"fmt"
	"strings"
)

// meUserID is the literal that stands in for the acting user anywhere a user
// reference is accepted. APIClient.ResolveUserID turns it into a real ID, so
// tools never have to know which endpoints understand it natively.
const meUserID = "me"

// userRefSchemaHint documents what a user-reference argument accepts. Every
// user-taking jsonschema tag ends with it so the model learns the convention
// once and applies it everywhere, instead of inferring that only opaque IDs
// work and giving up when it only knows a username.
const userRefSchemaHint = "Accepts a 26-character user ID, 'me' for the current user, or a username with or without a leading @ (for example '@bob' or 'bob')."

// resolveUserRef turns a user reference supplied by the model into a user ID.
// An empty reference stays empty so callers can treat it as "not provided";
// everything else is resolved, so a bad reference fails here with an
// actionable message rather than as an opaque API error later.
//
// This replaces validateID for user arguments: a username is a legitimate
// value, so shape validation alone would reject exactly the input models
// produce most often.
func resolveUserRef(ctx context.Context, client APIClient, ref, field string) (string, error) {
	trimmed := strings.TrimSpace(ref)
	if trimmed == "" {
		return "", nil
	}
	userID, err := client.ResolveUserID(ctx, trimmed)
	if err != nil {
		return "", fmt.Errorf("%s: %w", field, err)
	}
	if userID == "" {
		return "", fmt.Errorf("%s: could not resolve %q to a user", field, trimmed)
	}
	return userID, nil
}

// resolveUserRefs resolves a list of user references, reporting the failing
// index, and drops duplicates that different references resolved to.
func resolveUserRefs(ctx context.Context, client APIClient, refs []string, field string) ([]string, error) {
	resolved := make([]string, 0, len(refs))
	for i, ref := range refs {
		userID, err := resolveUserRef(ctx, client, ref, fmt.Sprintf("%s[%d]", field, i))
		if err != nil {
			return nil, err
		}
		if userID == "" {
			return nil, fmt.Errorf("%s[%d] is required", field, i)
		}
		resolved = appendUnique(resolved, userID)
	}
	return resolved, nil
}
