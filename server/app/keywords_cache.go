package app

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/pkg/errors"
)

type CachedPlaybook struct {
	ID                string
	Title             string
	TeamID            string
	SignalAnyKeywords []string
}

type KeywordsCacherImpl struct {
	updateAt  int64
	playbooks []*CachedPlaybook
	store     PlaybookStore
	logger    pluginapi.LogService
}

type KeywordsCacher interface {
	GetPlaybooks() []*CachedPlaybook
}

// Ensure KeywordsCacherImpl implements the KeywordsCacher interface.
var _ KeywordsCacher = (*KeywordsCacherImpl)(nil)

func NewPlaybookKeywordsCacher(store PlaybookStore, log pluginapi.LogService) KeywordsCacher {
	return &KeywordsCacherImpl{
		store:     store,
		playbooks: []*CachedPlaybook{},
		updateAt:  0,
		logger:    log,
	}
}

// GetPlaybooks gets cached playbooks
func (pc *KeywordsCacherImpl) GetPlaybooks() []*CachedPlaybook {
	if err := pc.updatePlaybooksIfNeeded(); err != nil {
		pc.logger.Error("can't update playbooks", "err", err.Error())
	}
	// even if error occurs while updating still returning previously cached playbooks
	return pc.playbooks
}

// updatePlaybooksIfNeeded caches playbooks
func (pc *KeywordsCacherImpl) updatePlaybooksIfNeeded() error {
	lastUpdatedDB, err := pc.store.GetTimeLastUpdated(true)
	if err != nil {
		return errors.Wrap(err, "can't get time last updated")
	}
	if lastUpdatedDB > pc.updateAt {
		if err := pc.update(); err != nil {
			return errors.Wrap(err, "can't update cache")
		}
	}
	return nil
}

func (pc *KeywordsCacherImpl) update() error {
	playbooks, err := pc.store.GetPlaybooksWithKeywords(PlaybookFilterOptions{Page: 0, PerPage: 1000})
	if err != nil {
		return errors.Wrap(err, "can't get playbooks to cache")
	}
	pc.playbooks = make([]*CachedPlaybook, 0, len(playbooks))
	pc.updateAt = 0
	for _, playbook := range playbooks {
		pc.playbooks = append(pc.playbooks, &CachedPlaybook{
			ID:                playbook.ID,
			Title:             playbook.Title,
			TeamID:            playbook.TeamID,
			SignalAnyKeywords: playbook.SignalAnyKeywords,
		})
		if pc.updateAt < playbook.UpdateAt {
			pc.updateAt = playbook.UpdateAt
		}
	}
	return nil
}
