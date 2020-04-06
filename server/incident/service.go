package incident

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-server/v5/model"
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

// GetHeaders returns filtered headers.
func (s *ServiceImpl) GetHeaders(options HeaderFilterOptions) ([]Header, error) {
	return s.store.GetHeaders(options)
}

// CreateIncident Creates a new incident.
func (s *ServiceImpl) CreateIncident(inc *Incident) (*Incident, error) {
	// Create incident
	inc, err := s.store.CreateIncident(inc)
	if err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}

	channel, err := s.createIncidentChannel(inc)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrChannelExists, err.Error())
	}

	// New incidents are always active
	inc.IsActive = true
	inc.ChannelIDs = []string{channel.Id}
	inc.CreatedAt = time.Now().Unix()

	if err = s.store.UpdateIncident(inc); err != nil {
		return nil, fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam("incident_update", inc, inc.TeamID)

	if err = s.poster.PostMessage(channel.Id, "%s", "An incident has occurred."); err != nil {
		return nil, fmt.Errorf("failed to post to incident channel: %w", err)
	}

	if inc.PostID == "" {
		return inc, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(inc.PostID)
	if err != nil {
		return nil, fmt.Errorf("failed to get incident original post: %w", err)
	}

	postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, inc.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	if err := s.poster.PostMessage(channel.Id, postMessage); err != nil {
		return nil, fmt.Errorf("failed to post to incident channel: %w", err)
	}

	return inc, nil
}

// CreateIncidentDialog Opens a interactive dialog to start a new incident.
func (s *ServiceImpl) CreateIncidentDialog(commanderID string, triggerID string, postID string) error {
	dialog, err := s.newIncidentDialog(commanderID, postID)
	if err != nil {
		return fmt.Errorf("failed to create new incident dialog: %w", err)
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("%s/plugins/%s/api/v1/incidents/dialog",
			*s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL,
			s.configService.GetManifest().Id),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return fmt.Errorf("failed to open new incident dialog: %w", err)
	}

	return nil
}

// EndIncident Completes the incident associated to the given channelID.
func (s *ServiceImpl) EndIncident(incidentID string, userID string) error {
	inc, err := s.store.GetIncident(incidentID)
	if err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	if err := s.endIncident(inc, userID); err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	return nil
}

// EndIncidentByChannel Completes the incident associated to the given channelID.
func (s *ServiceImpl) EndIncidentByChannel(channelID string, userID string) (*Incident, error) {
	inc, err := s.store.GetIncidentByChannel(channelID, true)
	if err != nil {
		return nil, fmt.Errorf("failed to end incident: %w", err)
	}

	if !inc.IsActive {
		return nil, ErrIncidentNotActive
	}
	if err := s.endIncident(inc, userID); err != nil {
		return nil, fmt.Errorf("failed to end incident: %w", err)
	}

	return inc, nil
}

// GetIncident Gets an incident by ID.
func (s *ServiceImpl) GetIncident(id string) (*Incident, error) {
	return s.store.GetIncident(id)
}

// NukeDB Removes all incident related data.
func (s *ServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

func (s *ServiceImpl) endIncident(incident *Incident, userID string) error {
	// Incident main channel membership is required to end incident
	incidentMainChannelID := incident.ChannelIDs[0]

	if !s.pluginAPI.User.HasPermissionToChannel(userID, incidentMainChannelID, model.PERMISSION_READ_CHANNEL) {
		return errors.New("user does not have permission to end incident")
	}

	// Close the incident
	incident.IsActive = false

	if err := s.store.UpdateIncident(incident); err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam("incident_update", incident, incident.TeamID)

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return fmt.Errorf("failed to to resolve user %s: %w", userID, err)
	}

	// Post in the  main incident channel that @user has ended the incident.
	// Main channel is the only channel in the incident for now.
	mainChannelID := incident.ChannelIDs[0]
	if err := s.poster.PostMessage(mainChannelID, "This incident has been closed by @%v", user.Username); err != nil {
		return fmt.Errorf("failed to post end incident messsage: %w", err)
	}

	return nil
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
		return nil, fmt.Errorf("failed to create incident channel: %w", err)
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incident.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, fmt.Errorf("failed to add user to channel: %w", err)
	}

	return channel, nil
}

func (s *ServiceImpl) newIncidentDialog(commanderID string, postID string) (*model.Dialog, error) {
	user, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch commander user: %w", err)
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
