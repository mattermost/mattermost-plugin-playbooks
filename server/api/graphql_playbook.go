package api

import (
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type playbookResolver struct {
	app.Playbook
}

func (r *playbookResolver) DeleteAt() float64 {
	return float64(r.Playbook.DeleteAt)
}
