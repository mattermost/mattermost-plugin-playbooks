package pluginkvstore

import (
	"encoding/json"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// PlaybookKey is the key for individual playbooks. Only exported for testing.
	PlaybookKey = keyVersionPrefix + "playbook_"
	// IndexKey is the key for the playbook index. Only exported for testing.
	IndexKey = keyVersionPrefix + "playbookindex"
)

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

// Ensure playbookStore implments the playbook.Store interface.
var _ playbook.Store = (*PlaybookStore)(nil)

type playbookIndex struct {
	PlaybookIDs []string `json:"playbook_ids"`
}

func (i *playbookIndex) clone() playbookIndex {
	newIndex := *i
	newIndex.PlaybookIDs = append([]string(nil), i.PlaybookIDs...)
	return newIndex
}

func (p *PlaybookStore) getIndex() (playbookIndex, error) {
	var index playbookIndex
	if err := p.kvAPI.Get(IndexKey, &index); err != nil {
		return index, errors.Wrap(err, "unable to get playbook index")
	}

	return index, nil
}

func (p *PlaybookStore) addToIndex(playbookID string) error {
	addID := func(oldValue []byte) (interface{}, error) {
		if oldValue == nil {
			return playbookIndex{
				PlaybookIDs: []string{playbookID},
			}, nil
		}

		var index playbookIndex
		if err := json.Unmarshal(oldValue, &index); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal oldValue into a playbookIndex")
		}

		newIndex := index.clone()
		newIndex.PlaybookIDs = append(newIndex.PlaybookIDs, playbookID)

		return newIndex, nil
	}

	if err := p.kvAPI.SetAtomicWithRetries(IndexKey, addID); err != nil {
		return errors.Wrap(err, "failed to set playbookIndex atomically")
	}
	return nil
}

func (p *PlaybookStore) removeFromIndex(playbookID string) error {
	removeID := func(oldValue []byte) (interface{}, error) {
		if oldValue == nil {
			return nil, nil
		}

		var index playbookIndex
		if err := json.Unmarshal(oldValue, &index); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal oldValue into a playbookIndex")
		}

		newIndex := index.clone()
		for i := range newIndex.PlaybookIDs {
			if newIndex.PlaybookIDs[i] == playbookID {
				newIndex.PlaybookIDs = append(newIndex.PlaybookIDs[:i], newIndex.PlaybookIDs[i+1:]...)
				break
			}
		}

		return newIndex, nil
	}

	if err := p.kvAPI.SetAtomicWithRetries(IndexKey, removeID); err != nil {
		return errors.Wrap(err, "failed to set playbookIndex atomically")
	}
	return nil
}

// Create creates a new playbook
func (p *PlaybookStore) Create(pbook playbook.Playbook) (string, error) {
	pbook.ID = model.NewId()

	saved, err := p.kvAPI.Set(PlaybookKey+pbook.ID, &pbook)
	if err != nil {
		return "", errors.Wrapf(err, "unable to save playbook to KV store")
	} else if !saved {
		return "", errors.New("unable to save playbook to KV store, KV Set didn't save")
	}

	err = p.addToIndex(pbook.ID)
	if err != nil {
		return "", err
	}

	return pbook.ID, nil
}

// Get retrieves a playbook
func (p *PlaybookStore) Get(id string) (playbook.Playbook, error) {
	var out playbook.Playbook

	if id == "" {
		return out, errors.New("ID cannot be empty")
	}

	err := p.kvAPI.Get(PlaybookKey+id, &out)
	if err != nil {
		return out, err
	}

	if out.ID != id {
		return out, playbook.ErrNotFound
	}

	return out, nil
}

// GetPlaybooks retrieves all playbooks.
//
// All playbooks are indexed in a dedicated key value and used to enumerate the existing playbooks.
func (p *PlaybookStore) GetPlaybooks() ([]playbook.Playbook, error) {
	index, err := p.getIndex()
	if err != nil {
		return nil, err
	}

	playbooks := make([]playbook.Playbook, 0, len(index.PlaybookIDs))
	for _, playbookID := range index.PlaybookIDs {
		// Ignoring error here for now. If a playbook is deleted after this function retrieves the index,
		// and error could be generated here that can be ignored. Other errors are unhelpful to the user.
		gotPlaybook, _ := p.Get(playbookID)
		playbooks = append(playbooks, gotPlaybook)
	}

	return playbooks, nil
}

// Update updates a playbook
func (p *PlaybookStore) Update(updated playbook.Playbook) error {
	if updated.ID == "" {
		return errors.New("updating playbook without ID")
	}

	ignoreOldValue := func(oldValue []byte) (interface{}, error) {
		return updated, nil
	}

	if err := p.kvAPI.SetAtomicWithRetries(PlaybookKey+updated.ID, ignoreOldValue); err != nil {
		return errors.Wrap(err, "failed to set playbookIndex atomically")
	}
	return nil
}

// Delete deletes a playbook. We do not mind if there is contention: if the playbook
// is successfully removed from the index (which p.removeFromIndex guarantees), it's okay if:
// 1. the playbook is deleted twice, or
// 2. the playbook is updated in between removeFromIndex and the delete: if first updated,
//    the playbook will still be deleted; if first deleted then the update will fail.
func (p *PlaybookStore) Delete(id string) error {
	if err := p.removeFromIndex(id); err != nil {
		return err
	}

	if _, err := p.kvAPI.Set(PlaybookKey+id, nil); err != nil {
		return err
	}

	return nil
}
