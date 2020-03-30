package incident

import (
	"fmt"
	"regexp"
	"strings"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// ServiceImpl holds the information needed by the IncidentService's methods to complete their functions.
type ServiceImpl struct {
	pluginAPI     *pluginapi.Client
	configService config.Service
	store         Store
	poster        bot.Poster
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldNameKey is the key for the incident name field used in CreateIncidentDialog
const DialogFieldNameKey = "incidentName"

// NewService Creates a new incident ServiceImpl.
func NewService(pluginAPI *pluginapi.Client, store Store, poster bot.Poster,
	configService config.Service) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI:     pluginAPI,
		store:         store,
		poster:        poster,
		configService: configService,
	}
}

// GetAllHeaders returns the headers for all incidents.
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

	channel, err := s.createIncidentChannel(incident)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create incident")
	}

	// New incidents are always active
	incident.IsActive = true
	incident.ChannelIDs = []string{channel.Id}

	if err = s.store.UpdateIncident(incident); err != nil {
		return nil, errors.Wrap(err, "failed to update incident")
	}

	s.poster.PublishWebsocketEventToTeam("incident_update", incident, incident.TeamID)

	if err = s.poster.PostMessage(channel.Id, "%s", "An incident has occurred."); err != nil {
		return nil, errors.Wrap(err, "failed to post to incident channel")
	}

	if incident.PostID == "" {
		return incident, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(incident.PostID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get incident original post")
	}

	postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, incident.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	if err := s.poster.PostMessage(channel.Id, postMessage); err != nil {
		return nil, errors.Wrap(err, "failed to post to incident channel")
	}

	return incident, nil
}

// CreateIncidentDialog Opens a interactive dialog to start a new incident.
func (s *ServiceImpl) CreateIncidentDialog(commanderID string, triggerID string, postID string) error {
	dialog, err := s.newIncidentDialog(commanderID, postID)
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

	s.poster.PublishWebsocketEventToTeam("incident_update", incident, incident.TeamID)

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

func (s *ServiceImpl) createIncidentChannel(incident *Incident) (*model.Channel, error) {
	channelHeader := "The channel was created by the Incident Response plugin."

	if incident.PostID != "" {
		postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, incident.PostID)

		channelHeader = fmt.Sprintf("[Original Post](%s) | %s", postURL, channelHeader)
	}

	channel := &model.Channel{
		TeamId:      incident.TeamID,
		Type:        model.CHANNEL_PRIVATE,
		DisplayName: incident.Name,
		Name:        cleanChannelName(incident.Name),
		Header:      channelHeader,
	}

	if err := s.pluginAPI.Channel.Create(channel); err != nil {
		return nil, errors.Wrap(err, "failed to create incident channel")
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, errors.Wrap(err, "failed to add user to channel")
	}

	return channel, nil
}

func (s *ServiceImpl) newIncidentDialog(commanderID string, postID string) (*model.Dialog, error) {
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
		State:          postID,
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
