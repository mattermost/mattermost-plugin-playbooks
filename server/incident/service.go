package incident

import (
	"fmt"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// ServiceImpl implements Incident service interface.
type ServiceImpl struct {
	pluginAPI *pluginapi.Client
	store     Store
	config    config.Service
	poster    bot.Poster
}

var _ Service = &ServiceImpl{}

const nameDialogField = "incidentName"

// NewService Creates a new incident service.
func NewService(pluginAPI *pluginapi.Client, poster bot.Poster, configService config.Service) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI: pluginAPI,
		poster:    poster,
		store:     NewStore(pluginAPI),
		config:    configService,
	}
}

// GetAllHeaders Creates a new incident.
func (s *ServiceImpl) GetAllHeaders() ([]Header, error) {
	return s.store.GetAllHeaders()
}

// CreateIncident Creates a new incident.
func (s *ServiceImpl) CreateIncident(incident *Incident) (*Incident, error) {
	// Create incident
	incident, err := s.store.CreateIncident(incident)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create incident")
	}

	// New incidents are always active
	incident.IsActive = true

	// Create channel
	channelDisplayName := fmt.Sprintf("%s %s", "Incident", incident.ID)

	//channelName := fmt.Sprintf("%s", incident.Name)
	channelName := fmt.Sprintf("%s_%s", "incident", incident.ID)

	channel := &model.Channel{
		TeamId:      incident.TeamID,
		Type:        model.CHANNEL_OPEN,
		DisplayName: channelDisplayName,
		Name:        channelName,
		Header:      "The channel used by the incident response plugin.",
	}

	if err := s.pluginAPI.Channel.Create(channel); err != nil {
		return nil, errors.Wrap(err, "failed to create channel")
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.CommanderUserID, s.config.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrap(err, "failed to add user to channel")
	}

	// Save incident with Channel info
	incident.ChannelIDs = []string{channel.Id}
	if err := s.store.UpdateIncident(incident); err != nil {
		return nil, errors.Wrap(err, "failed to update incident")
	}

	if err := s.poster.PostMessage(channel.Id, "%s", "An incident has occurred."); err != nil {
		return nil, errors.Wrap(err, "failed to post to incident channel")
	}

	return incident, nil
}

// CreateIncidentDialog Opens a interactive dialog to start a new incident.
func (s *ServiceImpl) CreateIncidentDialog(commanderID string, triggerID string) error {

	dialog, err := s.getStartIncidentDialog(commanderID)
	if err != nil {
		return err
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("%s/plugins/%s/api/v1/incidents/dialog",
			*s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL,
			s.config.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return err
	}

	return nil
}

func (s *ServiceImpl) getStartIncidentDialog(commanderID string) (*model.Dialog, error) {
	user, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return nil, err
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: fmt.Sprintf("**Commander:** %v", getUserDisplayName(user)),
		Elements: []model.DialogElement{{
			DisplayName: "Incident Name",
			Name:        nameDialogField,
			Type:        "text",
			HelpText:    "This would also be the name for the incident channel",
		}},
		SubmitLabel:    "Start Incident",
		NotifyOnCancel: false,
	}, nil
}

// EndIncident Completes the incident associated to the given channelID.
func (s *ServiceImpl) EndIncident(channelID string) (*Incident, error) {
	incident, err := s.store.GetIncidentByChannel(channelID, true)
	if err != nil {
		return nil, errors.Wrap(err, "failed to end incident")
	}

	// Close the incident
	incident.IsActive = false

	if err := s.store.UpdateIncident(incident); err != nil {
		return nil, errors.Wrap(err, "failed to end incident")
	}

	return incident, nil
}

// GetIncident Gets an incident by ID.
func (s *ServiceImpl) GetIncident(id string) (*Incident, error) {
	return s.store.GetIncident(id)
}

// NukeDB Removes all incident related data.
func (s *ServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

func getUserDisplayName(user *model.User) string {
	if user == nil {
		return ""
	}

	if user.FirstName != "" && user.LastName != "" {
		return fmt.Sprintf("%s %s", user.FirstName, user.LastName)
	}

	return fmt.Sprintf("@%s", user.Username)
}
