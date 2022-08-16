package app

import (
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/mattermost/mattermost-plugin-playbooks/server/metrics"
)

const (
	playbookCreatedWSEvent  = "playbook_created"
	playbookArchivedWSEvent = "playbook_archived"
	playbookRestoredWSEvent = "playbook_restored"
)

type playbookService struct {
	store          PlaybookStore
	poster         bot.Poster
	telemetry      PlaybookTelemetry
	api            *pluginapi.Client
	metricsService *metrics.Metrics
}

// NewPlaybookService returns a new playbook service
func NewPlaybookService(store PlaybookStore, poster bot.Poster, telemetry PlaybookTelemetry, api *pluginapi.Client, metricsService *metrics.Metrics) PlaybookService {
	return &playbookService{
		store:          store,
		poster:         poster,
		telemetry:      telemetry,
		api:            api,
		metricsService: metricsService,
	}
}

func (s *playbookService) Create(playbook Playbook, userID string) (string, error) {
	playbook.CreateAt = model.GetMillis()
	playbook.UpdateAt = playbook.CreateAt

	newID, err := s.store.Create(playbook)
	if err != nil {
		return "", err
	}
	playbook.ID = newID

	s.telemetry.CreatePlaybook(playbook, userID)

	s.poster.PublishWebsocketEventToTeam(playbookCreatedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	s.metricsService.IncrementPlaybookCreatedCount(1)
	return newID, nil
}

func (s *playbookService) Import(playbook Playbook, userID string) (string, error) {
	newID, err := s.Create(playbook, userID)
	if err != nil {
		return "", err
	}
	playbook.ID = newID
	s.telemetry.ImportPlaybook(playbook, userID)
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

func (s *playbookService) Update(playbook Playbook, userID string) error {
	if playbook.DeleteAt != 0 {
		return errors.New("cannot update a playbook that is archived")
	}

	playbook.UpdateAt = model.GetMillis()

	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook, userID)

	return nil
}

func (s *playbookService) Archive(playbook Playbook, userID string) error {
	if playbook.ID == "" {
		return errors.New("can't archive a playbook without an ID")
	}

	if err := s.store.Archive(playbook.ID); err != nil {
		return err
	}

	s.telemetry.DeletePlaybook(playbook, userID)
	s.metricsService.IncrementPlaybookArchivedCount(1)

	s.poster.PublishWebsocketEventToTeam(playbookArchivedWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return nil
}

func (s *playbookService) Restore(playbook Playbook, userID string) error {
	if playbook.ID == "" {
		return errors.New("can't restore a playbook without an ID")
	}

	if playbook.DeleteAt == 0 {
		return nil
	}

	if err := s.store.Restore(playbook.ID); err != nil {
		return err
	}

	s.telemetry.RestorePlaybook(playbook, userID)
	s.metricsService.IncrementPlaybookRestoredCount(1)

	s.poster.PublishWebsocketEventToTeam(playbookRestoredWSEvent, map[string]interface{}{
		"teamID": playbook.TeamID,
	}, playbook.TeamID)

	return nil
}

// AutoFollow method lets user to auto-follow all runs of a specific playbook
func (s *playbookService) AutoFollow(playbookID, userID string) error {
	if err := s.store.AutoFollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-follow the playbook `%s`", userID, playbookID)
	}

	playbook, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.AutoFollowPlaybook(playbook, userID)
	return nil
}

// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
func (s *playbookService) AutoUnfollow(playbookID, userID string) error {
	if err := s.store.AutoUnfollow(playbookID, userID); err != nil {
		return errors.Wrapf(err, "user `%s` failed to auto-unfollow the playbook `%s`", userID, playbookID)
	}

	playbook, err := s.store.Get(playbookID)
	if err != nil {
		return errors.Wrap(err, "failed to retrieve playbook run")
	}
	s.telemetry.AutoUnfollowPlaybook(playbook, userID)
	return nil
}

// GetAutoFollows returns list of users who auto-follow a playbook
func (s *playbookService) GetAutoFollows(playbookID string) ([]string, error) {
	autoFollows, err := s.store.GetAutoFollows(playbookID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get auto-follows for the playbook `%s`", playbookID)
	}

	return autoFollows, nil
}

// Duplicate duplicates a playbook
func (s *playbookService) Duplicate(playbook Playbook, userID string) (string, error) {
	newPlaybook := playbook.Clone()
	newPlaybook.ID = ""
	// Empty metric IDs if there are such. Otherwise, metrics will not be saved in the database.
	for i := range newPlaybook.Metrics {
		newPlaybook.Metrics[i].ID = ""
	}
	newPlaybook.Title = "Copy of " + playbook.Title

	return s.Create(newPlaybook, userID)
}

// get top playbooks for teams
func (s *playbookService) GetTopPlaybooksForTeam(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error) {
	permissionFlag, err := licenseAndGuestCheck(s, userID)
	if err != nil {
		return nil, err
	}
	if !permissionFlag {
		return nil, errors.New("User cannot access playbooks insights")
	}

	return s.store.GetTopPlaybooksForTeam(teamID, userID, opts)
}

// get top playbooks for users
func (s *playbookService) GetTopPlaybooksForUser(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error) {
	permissionFlag, err := licenseAndGuestCheck(s, userID)
	if err != nil {
		return nil, err
	}
	if !permissionFlag {
		return nil, errors.New("User cannot access playbooks insights")
	}

	return s.store.GetTopPlaybooksForUser(teamID, userID, opts)
}

func licenseAndGuestCheck(s *playbookService, userID string) (bool, error) {
	licenseError := errors.New("invalid license/authorization to use insights API")
	guestError := errors.New("Guests aren't authorized to use insights API")
	lic := s.api.System.GetLicense()
	if lic == nil {
		return false, licenseError
	}
	user, err := s.api.User.Get(userID)
	if err != nil {
		return false, err
	}
	if lic.SkuShortName != model.LicenseShortSkuProfessional && lic.SkuShortName != model.LicenseShortSkuEnterprise {
		return false, licenseError
	}
	if user.IsGuest() {
		return false, guestError
	}
	return true, nil
}
