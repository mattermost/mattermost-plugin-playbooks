package incident

import (
	"encoding/json"
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

// NewService creates a new incident ServiceImpl.
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

// CreateIncident creates a new incident.
func (s *ServiceImpl) CreateIncident(incdnt *Incident) (*Incident, error) {
	// Create incident
	incdnt, err := s.store.CreateIncident(incdnt)
	if err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}

	channel, err := s.createIncidentChannel(incdnt)
	if err != nil {
		return nil, err
	}

	// New incidents are always active
	incdnt.IsActive = true
	incdnt.ChannelIDs = []string{channel.Id}
	incdnt.CreatedAt = time.Now().Unix()

	if err = s.store.UpdateIncident(incdnt); err != nil {
		return nil, fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam("incident_update", incdnt, incdnt.TeamID)

	user, err := s.pluginAPI.User.Get(incdnt.CommanderUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to to resolve user %s: %w", incdnt.CommanderUserID, err)
	}

	if err = s.poster.PostMessage(channel.Id, "This incident has been started by @%s", user.Username); err != nil {
		return nil, fmt.Errorf("failed to post to incident channel: %w", err)
	}

	if incdnt.PostID == "" {
		return incdnt, nil
	}

	// Post the content and link of the original post
	post, err := s.pluginAPI.Post.GetPost(incdnt.PostID)
	if err != nil {
		return nil, fmt.Errorf("failed to get incident original post: %w", err)
	}

	postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, incdnt.PostID)
	postMessage := fmt.Sprintf("[Original Post](%s)\n > %s", postURL, post.Message)

	if err := s.poster.PostMessage(channel.Id, postMessage); err != nil {
		return nil, fmt.Errorf("failed to post to incident channel: %w", err)
	}

	return incdnt, nil
}

// CreateIncidentDialog opens a interactive dialog to start a new incident.
func (s *ServiceImpl) CreateIncidentDialog(commanderID, triggerID, postID, clientID string) error {
	dialog, err := s.newIncidentDialog(commanderID, postID, clientID)
	if err != nil {
		return fmt.Errorf("failed to create new incident dialog: %w", err)
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v1/incidents/dialog?client_id=%s",
			s.configService.GetManifest().Id,
			clientID),
		Dialog:    *dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return fmt.Errorf("failed to open new incident dialog: %w", err)
	}

	return nil
}

// EndIncident completes the incident. It returns an ErrIncidentNotActive if the caller tries to
// end an incident which is not active.
func (s *ServiceImpl) EndIncident(incidentID string, userID string) error {
	incdnt, err := s.store.GetIncident(incidentID)
	if err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	if !incdnt.IsActive {
		return ErrIncidentNotActive
	}

	// Incident main channel membership is required to end incident
	incidentMainChannelID := incdnt.ChannelIDs[0]

	if !s.pluginAPI.User.HasPermissionToChannel(userID, incidentMainChannelID, model.PERMISSION_READ_CHANNEL) {
		return errors.New("user does not have permission to end incident")
	}

	// Close the incident
	incdnt.IsActive = false

	if err = s.store.UpdateIncident(incdnt); err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam("incident_update", incdnt, incdnt.TeamID)

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return fmt.Errorf("failed to to resolve user %s: %w", userID, err)
	}

	// Post in the  main incident channel that @user has ended the incident.
	// Main channel is the only channel in the incident for now.
	mainChannelID := incdnt.ChannelIDs[0]
	if err := s.poster.PostMessage(mainChannelID, "This incident has been closed by @%v", user.Username); err != nil {
		return fmt.Errorf("failed to post end incident messsage: %w", err)
	}

	return nil
}

// EndIncidentByChannel completes the incident associated to the given channelID.
func (s *ServiceImpl) EndIncidentByChannel(channelID string, userID string) error {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)
	if err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	if err := s.EndIncident(incidentID, userID); err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	return nil
}

// GetIncident gets an incident by ID.
func (s *ServiceImpl) GetIncident(id string) (*Incident, error) {
	return s.store.GetIncident(id)
}

// NukeDB removes all incident related data.
func (s *ServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

func (s *ServiceImpl) createIncidentChannel(incdnt *Incident) (*model.Channel, error) {
	channelHeader := "The channel was created by the Incident Response plugin."

	if incdnt.PostID != "" {
		postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, incdnt.PostID)

		channelHeader = fmt.Sprintf("[Original Post](%s) | %s", postURL, channelHeader)
	}

	channel := &model.Channel{
		TeamId:      incdnt.TeamID,
		Type:        model.CHANNEL_PRIVATE,
		DisplayName: incdnt.Name,
		Name:        cleanChannelName(incdnt.Name),
		Header:      channelHeader,
	}

	// Loop in case we accidentally chose an existing channel name
	// Prefer the channel name the user chose. But if it already exists, add some random bits.
	for succeeded := false; !succeeded; {
		if err := s.pluginAPI.Channel.Create(channel); err != nil {
			if appErr, ok := err.(*model.AppError); ok {

				// Let the user correct display name errors:
				if appErr.Id == "model.channel.is_valid.display_name.app_error" {
					return nil, ErrChannelDisplayNameLong
				}

				// We can fix channel Name errors:
				if appErr.Id == "store.sql_channel.save_channel.exists.app_error" ||
					appErr.Id == "model.channel.is_valid.2_or_more.app_error" {
					channel.Name = addRandomBits(channel.Name)
					continue
				}
			}
			return nil, fmt.Errorf("failed to create incident channel: %w", err)
		}
		succeeded = true
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incdnt.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, fmt.Errorf("failed to add user to channel: %w", err)
	}

	return channel, nil
}

func (s *ServiceImpl) newIncidentDialog(commanderID, postID, clientID string) (*model.Dialog, error) {
	user, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch commander user: %w", err)
	}

	state, err := json.Marshal(DialogState{
		PostID:   postID,
		ClientID: clientID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal DialogState: %w", err)
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: fmt.Sprintf("**Commander:** %v", getUserDisplayName(user)),
		Elements: []model.DialogElement{{
			DisplayName: "Channel Name",
			Name:        DialogFieldNameKey,
			Type:        "text",
			MinLength:   2,
			MaxLength:   64,
		}},
		SubmitLabel:    "Start Incident",
		NotifyOnCancel: false,
		State:          string(state),
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

func addRandomBits(name string) string {
	// Fix too long names (we're adding 5 chars):
	if len(name) > 59 {
		name = name[:59]
	}
	randBits := model.NewId()
	return fmt.Sprintf("%s-%s", name, randBits[:4])
}
