package pluginkvstore

import (
	"fmt"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
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
		return index, fmt.Errorf("unable to get playbook index %w", err)
	}

	return index, nil
}

func (p *playbookStore) addToIndex(playbookid string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index
	newIndex.Playbooks = append([]string(nil), index.Playbooks...)
	newIndex.Playbooks = append(newIndex.Playbooks, playbookid)

	// Set atomic doesn't seeem to work properly.
	saved, err := p.kvAPI.Set(indexKey, &newIndex) //, pluginapi.SetAtomic(&index))
	if err != nil {
		return fmt.Errorf("Unable to add playbook to index %w", err)
	} else if !saved {
		return fmt.Errorf("Unable add playbook to index KV Set didn't save")
	}

	return nil
}

func (p *playbookStore) removeFromIndex(playbookid string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index
	newIndex.Playbooks = append([]string(nil), index.Playbooks...)

	for i := range newIndex.Playbooks {
		if newIndex.Playbooks[i] == playbookid {
			newIndex.Playbooks = append(newIndex.Playbooks[:i], newIndex.Playbooks[i+1:]...)
			break
		}
	}

	// Set atomic doesn't seeem to work properly.
	saved, err := p.kvAPI.Set(indexKey, &newIndex) //, pluginapi.SetAtomic(&index))
	if err != nil {
		return fmt.Errorf("Unable to add playbook to index %w", err)
	} else if !saved {
		return fmt.Errorf("Unable add playbook to index KV Set didn't save")
	}

	return nil
}

func (p *playbookStore) Create(playbook playbook.Playbook) (string, error) {
	playbook.ID = model.NewId()

	saved, err := p.kvAPI.Set(playbookKey+playbook.ID, &playbook)
	if err != nil {
		return "", fmt.Errorf("Unable to save playbook to KV store %w", err)
	} else if !saved {
		return "", fmt.Errorf("Unable to save playbook to KV store, KV Set didn't save")
	}

	err = p.addToIndex(playbook.ID)
	if err != nil {
		return "", err
	}

	return playbook.ID, nil
}

func (p *playbookStore) Get(id string) (playbook.Playbook, error) {
	var out playbook.Playbook
	err := p.kvAPI.Get(playbookKey+id, &out)
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
				cumulativeError = fmt.Errorf(err.Error()+"%w", cumulativeError)
			} else {
				cumulativeError = err
			}
		}
	}

	return playbooks, cumulativeError
}

func (p *playbookStore) Update(updated playbook.Playbook) error {
	if updated.ID == "" {
		return fmt.Errorf("Updating playbook without ID")
	}

	saved, err := p.kvAPI.Set(playbookKey+updated.ID, &updated)
	if err != nil {
		return fmt.Errorf("Unable to update playbook in KV store %w", err)
	} else if !saved {
		return fmt.Errorf("Unable to update playbook in KV store, KV Set didn't save")
	}

	return nil
}

func (p *playbookStore) Delete(id string) error {
	if err := p.removeFromIndex(id); err != nil {
		return err
	}

	if _, err := p.kvAPI.Set(playbookKey+id, nil); err != nil {
		return err
	}

	return nil
}
