// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package ops

import (
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// Playbooks is the shared playbook read path for HTTP and Weave.
type Playbooks struct {
	Service     app.PlaybookService
	Permissions *app.PermissionsService
}

// Read loads one playbook after the view check and the flow ceiling.
func (p *Playbooks) Read(c Caller, playbookID string) (*app.Playbook, error) {
	if err := p.Permissions.PlaybookView(c.Principal, playbookID); err != nil {
		return nil, err
	}
	playbook, err := p.Service.Get(playbookID)
	if err != nil {
		return nil, err
	}
	if err := c.Reject(playbook.TeamID); err != nil {
		return nil, err
	}
	if invoker := c.Other(); invoker != "" {
		if err := p.Permissions.PlaybookManageProperties(invoker, playbook); err != nil {
			return nil, err
		}
	}
	return &playbook, nil
}
