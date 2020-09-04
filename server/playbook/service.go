package playbook

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
)

type service struct {
	store     Store
	poster    bot.Poster
	telemetry Telemetry
}

// NewService returns a new playbook service
func NewService(store Store, poster bot.Poster, telemetry Telemetry) Service {
	return &service{
		store:     store,
		poster:    poster,
		telemetry: telemetry,
	}
}

func (s *service) Create(playbook Playbook) (string, error) {
	playbook.CreateAt = model.GetMillis()

	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.telemetry.CreatePlaybook(playbook)

	return newID, nil
}

func (s *service) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *service) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *service) GetPlaybooksForTeam(teamID string, opts Options) ([]Playbook, error) {
	return s.store.GetPlaybooksForTeam(teamID, opts)
}

func (s *service) Update(playbook Playbook) error {
	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook)

	return nil
}

func (s *service) Delete(playbook Playbook) error {
	if playbook.ID == "" {
		return errors.New("can't delete a playbook without an ID")
	}

	if err := s.store.Delete(playbook.ID); err != nil {
		return err
	}

	s.telemetry.DeletePlaybook(playbook)

	return nil
}
