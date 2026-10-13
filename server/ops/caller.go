// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ops

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// Caller is the user an action runs as, plus the flow ceiling.
// A session request leaves RunAs and OwnerScope empty, so the ceiling is a no-op.
type Caller struct {
	Principal  string
	Invoker    string
	OwnerScope string
	RunAs      string
}

// Other is the invoker when that person is not the principal.
func (c Caller) Other() string {
	if c.Invoker == "" || c.Invoker == c.Principal {
		return ""
	}
	return c.Invoker
}

// Reject applies the flow ceiling for a team.
func (c Caller) Reject(teamID string) error {
	if c.RunAs == "bot" {
		return errors.Wrap(app.ErrNoPermissions, "bot run-as is not available for this action")
	}
	if c.OwnerScope != "" && c.OwnerScope != "global" && teamID != "" && c.OwnerScope != teamID {
		return errors.Wrap(app.ErrNoPermissions, "this automation cannot act on another team's run")
	}
	return nil
}
