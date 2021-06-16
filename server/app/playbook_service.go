package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
)

const (
	playbookCreatedWSEvent = "playbook_created"
	playbookDeletedWSEvent = "playbook_deleted"
)

type playbookService struct {
	store     PlaybookStore
	poster    bot.Poster
	telemetry PlaybookTelemetry
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, telemetry PlaybookTelemetry) PlaybookService {
	return &playbookService{
		store:     store,
		poster:    poster,
		telemetry: telemetry,
	}
}

func (s *playbookService) Create(playbook Playbook, userID string) (string, error) {
	playbook.CreateAt = model.GetMillis()

	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.telemetry.CreatePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return newID, nil
}

func (s *playbookService) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *playbookService) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *playbookService) GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error) {
	return s.store.GetPlaybooksForTeam(requesterInfo, teamID, opts)
}

func (s *playbookService) GetNumPlaybooksForTeam(teamID string) (int, error) {
	return s.store.GetNumPlaybooksForTeam(teamID)
}

func (s *playbookService) Update(playbook Playbook, userID string) error {
	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook, userID)

	return nil
}

func (s *playbookService) Delete(playbook Playbook, userID string) error {
	if playbook.ID == "" {
		return errors.New("can't delete a playbook without an ID")
	}

	if err := s.store.Delete(playbook.ID); err != nil {
		return err
	}

	s.telemetry.DeletePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookDeletedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return nil
}
