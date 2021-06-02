package playbook

import (
	"strings"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/bot"
)

const (
	playbookCreatedWSEvent = "playbook_created"
	playbookDeletedWSEvent = "playbook_deleted"
)

type service struct {
	store     Store
	poster    bot.Poster
	cacher    Cacher
	telemetry Telemetry
	api       *pluginapi.Client
}

// NewService returns a new playbook service
func NewService(store Store, poster bot.Poster, telemetry Telemetry, api *pluginapi.Client) Service {
	return &service{
		store:     store,
		poster:    poster,
		cacher:    NewPlaybookCacher(store),
		telemetry: telemetry,
		api:       api,
	}
}

func (s *service) Create(playbook Playbook, userID string) (string, error) {
	playbook.CreateAt = model.GetMillis()
	playbook.UpdatedAt = playbook.CreateAt

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

func (s *service) Get(id string) (Playbook, error) {
	return s.store.Get(id)
}

func (s *service) GetPlaybooks() ([]Playbook, error) {
	return s.store.GetPlaybooks()
}

func (s *service) GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts Options) (GetPlaybooksResults, error) {
	return s.store.GetPlaybooksForTeam(requesterInfo, teamID, opts)
}

func (s *service) GetNumPlaybooksForTeam(teamID string) (int, error) {
	return s.store.GetNumPlaybooksForTeam(teamID)
}

func (s *service) Update(playbook Playbook, userID string) error {
	playbook.UpdatedAt = model.GetMillis()
	if err := s.store.Update(playbook); err != nil {
		return err
	}

	s.telemetry.UpdatePlaybook(playbook, userID)

	return nil
}

func (s *service) Delete(playbook Playbook, userID string) error {
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

func (s *service) GetSuggestedPlaybooks(post *model.Post) []*CachedPlaybook {
	triggeredPlaybooks := []*CachedPlaybook{}

	channel, channelErr := s.api.Channel.Get(post.ChannelId)
	if channelErr != nil {
		s.api.Log.Error("can't get channel", "err", channelErr.Error())
		return triggeredPlaybooks
	}
	teamID := channel.TeamId

	if err := s.cacher.UpdatePlaybooksIfNeeded(); err != nil {
		s.api.Log.Error("can't update playbooks", "err", err.Error())
		return triggeredPlaybooks
	}
	playbooks := s.cacher.GetPlaybooks()

	for i := range playbooks {
		if playbooks[i].TeamID != teamID {
			continue
		}

		if !isPlaybookTriggeredByMessage(playbooks[i], post.Message) {
			continue
		}

		triggeredPlaybooks = append(triggeredPlaybooks, playbooks[i])
	}

	// return early if no triggered playbooks
	if len(triggeredPlaybooks) == 0 {
		return triggeredPlaybooks
	}

	return s.filterPlaybooksByAccess(triggeredPlaybooks, post.UserId, teamID)
}

// filters out playbooks user has no access to
func (s *service) filterPlaybooksByAccess(triggeredPlaybooks []*CachedPlaybook, userID, teamID string) []*CachedPlaybook {
	filteredPlaybooks := []*CachedPlaybook{}
	playbookIDs, err := s.store.GetPlaybookIDsForUser(userID, teamID)
	if err != nil {
		s.api.Log.Error("can't get playbookIDs", "userID", userID, "err", err.Error())
		return filteredPlaybooks
	}

	playbookIDsMap := sliceToMap(playbookIDs)

	for i := range triggeredPlaybooks {
		if ok := playbookIDsMap[triggeredPlaybooks[i].ID]; ok {
			filteredPlaybooks = append(filteredPlaybooks, triggeredPlaybooks[i])
		}
	}

	return filteredPlaybooks
}

func isPlaybookTriggeredByMessage(playbook *CachedPlaybook, message string) bool {
	for _, keyword := range playbook.SignalAnyKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func sliceToMap(strs []string) map[string]bool {
	res := make(map[string]bool, len(strs))
	for _, s := range strs {
		res[s] = true
	}
	return res
}
