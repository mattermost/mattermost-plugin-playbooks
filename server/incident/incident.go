package incident

import (
	"fmt"

	pluginApi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// ErrNotFound used to indicate entity not found.
var ErrNotFound = errors.New("not found")

// Header holds the summary information of an incident.
type Header struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	IsActive        bool   `json:"is_active"`
	CommanderUserID string `json:"commander_user_id"`
	TeamID          string `json:"team_id"`
}

// Incident holds the detailed information of an incident.
type Incident struct {
	Header
	ChannelIDs []string `json:"channel_ids"`
}

// Service holds the information needed by the Incident methods to complete its functions.
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
	channelDisplayName := fmt.Sprintf("%s %s", "Incident", incident.ID)
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

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrap(err, "failed to add user to channel")
	}

	// Save incident with Channel info
	incident.ChannelIDs = []string{channel.Id}
	incident.Name = fmt.Sprintf("Incident %s", incident.ID)
	if err := s.store.UpdateIncident(incident); err != nil {
		return nil, errors.Wrap(err, "failed to update incident")
	}

	if err := s.poster.PostMessage(channel.Id, "%s", "An incident has occurred."); err != nil {
		return nil, errors.Wrap(err, "failed to post to incident channel")
	}

	return incident, nil
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
