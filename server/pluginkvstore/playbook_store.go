package pluginkvstore

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

const (
	playbookKey = "playbook_"
	indexKey    = "playbookindex"
)

type KVAPI interface {
	Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error)
	Get(key string, out interface{}) error
}

type playbookStore struct {
	kvAPI KVAPI
}

func NewPlaybookStore(kvAPI KVAPI) *playbookStore {
	return &playbookStore{
		kvAPI: kvAPI,
	}
}

// playbookStore Implments the playbook store interface.
var _ playbook.Store = (*playbookStore)(nil)

type playbookIndex struct {
	Playbooks []string `json:"playbooks"`
}

func (p *playbookStore) getIndex() (playbookIndex, error) {
	var index playbookIndex
	if err := p.kvAPI.Get(indexKey, &index); err != nil {
		return index, errors.Wrap(err, "unable to get playbook index")
	}

	return index, nil
}

func (p *playbookStore) Create(playbook playbook.Playbook) (string, error) {
	playbook.ID = model.NewId()

	saved, err := p.kvAPI.Set(playbookKey+playbook.ID, &playbook)
	if err != nil {
		return "", errors.Wrap(err, "Unable to save playbook to KV store")
	} else if !saved {
		return "", errors.New("Unable to save playbook to KV store, KV Set didn't save")
	}

	return playbook.ID, nil
}

func (p *playbookStore) Get(id string) (playbook.Playbook, error) {
	var out playbook.Playbook
	err := p.kvAPI.Get(id, &out)
	if err != nil {
		return out, err
	}
	return out, nil
}

func (p *playbookStore) GetPlaybooks() ([]playbook.Playbook, error) {
	index, err := p.getIndex()
	if err != nil {
		return nil, err
	}

	var cumulativeError error
	playbooks := make([]playbook.Playbook, len(index.Playbooks))
	for i, playbookId := range index.Playbooks {
		playbooks[i], err = p.Get(playbookId)
		if err != nil {
			if cumulativeError != nil {
				cumulativeError = errors.Wrap(cumulativeError, err.Error())
			} else {
				cumulativeError = err
			}
		}
	}

	return playbooks, cumulativeError
}
