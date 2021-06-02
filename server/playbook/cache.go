package playbook

import (
	"github.com/pkg/errors"
)

type CachedPlaybook struct {
	ID                string
	Title             string
	TeamID            string
	SignalAnyKeywords []string
}

type CacherImpl struct {
	updatedAt int64
	playbooks []*CachedPlaybook
	store     Store
}

type Cacher interface {
	GetPlaybooks() []*CachedPlaybook
	UpdatePlaybooksIfNeeded() error
}

// Ensure CacherImpl implements the Cacher interface.
var _ Cacher = (*CacherImpl)(nil)

func NewPlaybookCacher(store Store) Cacher {
	return &CacherImpl{
		store:     store,
		playbooks: []*CachedPlaybook{},
		updatedAt: 0,
	}
}

// GetPlaybooks gets cached playbooks
func (pc *CacherImpl) GetPlaybooks() []*CachedPlaybook {
	return pc.playbooks
}

// UpdatePlaybooksIfNeeded caches playbooks
func (pc *CacherImpl) UpdatePlaybooksIfNeeded() error {
	lastUpdatedDB, err := pc.store.GetTimeLastUpdated()
	if err != nil {
		return errors.Wrap(err, "can't get time last updated")
	}
	if lastUpdatedDB > pc.updatedAt {
		if err := pc.update(); err != nil {
			return errors.Wrap(err, "can't update cache")
		}
	}
	return nil
}

func (pc *CacherImpl) update() error {
	playbooks, err := pc.store.GetPlaybooksWithKeywords(Options{})
	if err != nil {
		return errors.Wrap(err, "can't get playbooks to cache")
	}
	pc.playbooks = make([]*CachedPlaybook, 0, len(playbooks))
	pc.updatedAt = 0
	for _, playbook := range playbooks {
		pc.playbooks = append(pc.playbooks, &CachedPlaybook{
			ID:                playbook.ID,
			Title:             playbook.Title,
			TeamID:            playbook.TeamID,
			SignalAnyKeywords: playbook.SignalAnyKeywords,
		})
		if pc.updatedAt < playbook.UpdatedAt {
			pc.updatedAt = playbook.UpdatedAt
		}
	}
	return nil
}
