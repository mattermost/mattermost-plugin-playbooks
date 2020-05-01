package playbook

import (
	"errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
)

type service struct {
	store  Store
	poster bot.Poster
}

const (
	playbookCreated = "playbook_created"
	playbookUpdated = "playbook_updated"
	playbookDeleted = "playbook_deleted"
)

// NewService returns a new playbook service
func NewService(store Store, poster bot.Poster) Service {
	return &service{
		store:  store,
		poster: poster,
	}
}

func (s *service) Create(playbook Playbook) (string, error) {
	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.poster.PublishWebsocketEventToTeam(playbookCreated, playbook, playbook.TeamID)

	return newID, nil
}

func (s *service) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *service) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *service) GetPlaybooksForTeam(teamID string) ([]Playbook, error) {
	playbooks, err := s.store.GetPlaybooks()
	if err != nil {
		return nil, err
	}

	teamPlaybooks := make([]Playbook, 0, len(playbooks))
	for _, playbook := range playbooks {
		if playbook.TeamID == teamID {
			teamPlaybooks = append(teamPlaybooks, playbook)
		}
	}

	return teamPlaybooks, nil
}

func (s *service) Update(playbook Playbook) error {
	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.poster.PublishWebsocketEventToTeam(playbookUpdated, playbook, playbook.TeamID)

	return nil
}

func (s *service) Delete(playbook Playbook) error {
	if playbook.ID == "" {
		return errors.New("can't delete a playbook without an ID")
	}

	if err := s.store.Delete(playbook.ID); err != nil {
		return err
	}

	s.poster.PublishWebsocketEventToTeam(playbookDeleted, playbook, playbook.TeamID)

	return nil
}
