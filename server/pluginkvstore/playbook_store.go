package pluginkvstore

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	playbookKey = "playbook_"
)

type playbookStore struct {
	pluginAPI *pluginapi.Client
}

// playbookStore Implments the playbook store interface.
var _ playbook.Store = (*playbookStore)(nil)

func (p *playbookStore) Create(playbook playbook.Playbook) (string, error) {
	playbook.ID = model.NewId()

	saved, err := p.pluginAPI.KV.Set(playbookKey+playbook.ID, &playbook)
	if err != nil {
		return "", errors.Wrap(err, "Unable to save playbook to KV store")
	} else if !saved {
		return "", errors.New("Unable to save playbook to KV store, KV Set didn't save")
	}

	return playbook.ID, nil
}
