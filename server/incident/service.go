package incident

import (
	"fmt"
	"regexp"
	"strings"

	pluginApi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// Service holds the information needed by the IncidentService's methods to complete their functions.
type Service struct {
	pluginAPI     *pluginApi.Client
	configService Config
	store         Store
	poster        bot.Poster
}

// Config defines the methods we need from the Config.
type Config interface {
	// GetConfiguration retrieves the active configuration under lock, making it safe to use
	// concurrently.
	GetConfiguration() *config.Configuration

	// GetManifest gets the plugin manifest.
	GetManifest() *model.Manifest
}

// Store defines the methods we need from the Store.
type Store interface {
	// GetAllHeaders Gets all the header information.
	GetAllHeaders() ([]Header, error)

	// CreateIncident Creates a new incident.
	CreateIncident(incident *Incident) (*Incident, error)

	// UpdateIncident updates an incident.
	UpdateIncident(incident *Incident) error

	// GetIncident Gets an incident by ID.
	GetIncident(id string) (*Incident, error)

	// GetIncidentByChannel Gets an incident associated with the given channel id.
	GetIncidentByChannel(channelID string, active bool) (*Incident, error)

	// NukeDB Removes all incident related data.
	NukeDB() error
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldNameKey is the key for the incident name field used in CreateIncidentDialog
const DialogFieldNameKey = "incidentName"

// NewService Creates a new incident service.
func NewService(pluginAPI *pluginApi.Client, store Store, poster bot.Poster,
	configService Config) *Service {
	return &Service{
		pluginAPI:     pluginAPI,
		store:         store,
		poster:        poster,
		configService: configService,
	}
}

// GetAllHeaders returns the headers for all incidents.
func (s *Service) GetAllHeaders() ([]Header, error) {
	return s.store.GetAllHeaders()
}

// CreateIncident Creates a new incident.
func (s *Service) CreateIncident(incident *Incident) (*Incident, error) {
	// Create incident
	incident, err := s.store.CreateIncident(incident)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create incident")
	}

	// New incidents are always active
	incident.IsActive = true

	// Create channel
	channel := &model.Channel{
		TeamId:      incident.TeamID,
		Type:        model.CHANNEL_OPEN,
		DisplayName: incident.Name,
		Name:        cleanChannelName(incident.Name),
		Header:      "The channel used by the incident response plugin.",
	}

	if err := s.pluginAPI.Channel.Create(channel); err != nil {
		return nil, errors.Wrap(err, "failed to create channel")
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
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
func (s *Service) CreateIncidentDialog(commanderID string, triggerID string) error {
	dialog, err := s.newIncidentDialog(commanderID)
	if err != nil {
		return errors.Wrap(err, "failed to create new incident dialog")
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("%s/plugins/%s/api/v1/incidents/dialog",
			*s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL,
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return errors.Wrap(err, "failed to open new incident dialog")
	}

	return nil
}

// EndIncident Completes the incident associated to the given channelID.
func (s *Service) EndIncident(channelID string) (*Incident, error) {
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
func (s *Service) GetIncident(id string) (*Incident, error) {
	return s.store.GetIncident(id)
}

// NukeDB Removes all incident related data.
func (s *Service) NukeDB() error {
	return s.store.NukeDB()
}

func (s *Service) newIncidentDialog(commanderID string) (*model.Dialog, error) {
	user, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to fetch commander user")
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: fmt.Sprintf("**Commander:** %v", getUserDisplayName(user)),
		Elements: []model.DialogElement{{
			DisplayName: "Channel Name",
			Name:        DialogFieldNameKey,
			Type:        "text",
		}},
		SubmitLabel:    "Start Incident",
		NotifyOnCancel: false,
	}, nil
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

func cleanChannelName(channelName string) string {
	// Lower case only
	channelName = strings.ToLower(channelName)
	// Trim spaces
	channelName = strings.TrimSpace(channelName)
	// Change all dashes to whitespace, remove evrything that's not a word or whitespace, all space becomes dashes
	channelName = strings.ReplaceAll(channelName, "-", " ")
	channelName = allNonSpaceNonWordRegex.ReplaceAllString(channelName, "")
	channelName = strings.ReplaceAll(channelName, " ", "-")
	// Remove all leading and trailing dashes
	channelName = strings.Trim(channelName, "-")

	return channelName
}
