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

// KVAPI is the key value store interface for the playbooks store. Implemented by mattermost-plugin-api/Client.KV.
type KVAPI interface {
	Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error)
	Get(key string, out interface{}) error
}

// PlaybookStore is a kvs store for playbooks. DO NO USE DIRECTLY Use NewPlaybookStore
type PlaybookStore struct {
	kvAPI KVAPI
}

// NewPlaybookStore returns a new playbook store.
func NewPlaybookStore(kvAPI KVAPI) *PlaybookStore {
	return &PlaybookStore{
		kvAPI: kvAPI,
	}
}

// playbookStore Implments the playbook store interface.
var _ playbook.Store = (*PlaybookStore)(nil)

type playbookIndex struct {
	PlaybookIDs []string `json:"playbook_ids"`
}

func (p *PlaybookStore) getIndex() (playbookIndex, error) {
	var index playbookIndex
	if err := p.kvAPI.Get(indexKey, &index); err != nil {
		return index, fmt.Errorf("unable to get playbook index %w", err)
	}

	return index, nil
}

func (p *PlaybookStore) addToIndex(playbookid string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index
	newIndex.PlaybookIDs = append([]string(nil), index.PlaybookIDs...)
	newIndex.PlaybookIDs = append(newIndex.PlaybookIDs, playbookid)

	// Set atomic doesn't seeem to work properly.
	saved, err := p.kvAPI.Set(indexKey, &newIndex) //, pluginapi.SetAtomic(&index))
	if err != nil {
		return fmt.Errorf("Unable to add playbook to index %w", err)
	} else if !saved {
		return fmt.Errorf("Unable add playbook to index KV Set didn't save")
	}

	return nil
}

func (p *PlaybookStore) removeFromIndex(playbookid string) error {
	index, err := p.getIndex()
	if err != nil {
		return err
	}

	newIndex := index
	newIndex.PlaybookIDs = append([]string(nil), index.PlaybookIDs...)

	for i := range newIndex.PlaybookIDs {
		if newIndex.PlaybookIDs[i] == playbookid {
			newIndex.PlaybookIDs = append(newIndex.PlaybookIDs[:i], newIndex.PlaybookIDs[i+1:]...)
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

// Create creates a new playbook
func (p *PlaybookStore) Create(playbook playbook.Playbook) (string, error) {
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

// Get retrieves a playbook
func (p *PlaybookStore) Get(id string) (playbook.Playbook, error) {
	var out playbook.Playbook
	err := p.kvAPI.Get(playbookKey+id, &out)
	if err != nil {
		return out, err
	}
	return out, nil
}

// GetPlaybooks retrieves all playbooks
func (p *PlaybookStore) GetPlaybooks() ([]playbook.Playbook, error) {
	index, err := p.getIndex()
	if err != nil {
		return nil, err
	}

	var cumulativeError error
	playbooks := make([]playbook.Playbook, len(index.PlaybookIDs))
	for i, playbookID := range index.PlaybookIDs {
		playbooks[i], err = p.Get(playbookID)
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

// Update updates a playbook
func (p *PlaybookStore) Update(updated playbook.Playbook) error {
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

// Delete deletes a playbook
func (p *PlaybookStore) Delete(id string) error {
	if err := p.removeFromIndex(id); err != nil {
		return err
	}

	if _, err := p.kvAPI.Set(playbookKey+id, nil); err != nil {
		return err
	}

	return nil
}
