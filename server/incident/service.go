package incident

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-incident-response/server/bot"
	"github.com/mattermost/mattermost-plugin-incident-response/server/config"
	"github.com/mattermost/mattermost-plugin-incident-response/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	// IncidentCreatedWSEvent is for incident creation.
	IncidentCreatedWSEvent = "incident_created"
	incidentUpdatedWSEvent = "incident_updated"
)

// ServiceImpl holds the information needed by the IncidentService's methods to complete their functions.
type ServiceImpl struct {
	pluginAPI     *pluginapi.Client
	configService config.Service
	store         Store
	poster        bot.Poster
	telemetry     Telemetry
}

var allNonSpaceNonWordRegex = regexp.MustCompile(`[^\w\s]`)

// DialogFieldNameKey is the key for the incident name field used in OpenCreateIncidentDialog.
const DialogFieldNameKey = "incidentName"

// DialogFieldPlaybookIDKey is the key for the playbook ID field used in OpenCreateIncidentDialog.
const DialogFieldPlaybookIDKey = "playbookID"

// DialogFieldIsPublicKey is the key for the public or private field used in OpenCreateIncidentDialog.
const DialogFieldIsPublicKey = "public"

// NewService creates a new incident ServiceImpl.
func NewService(pluginAPI *pluginapi.Client, store Store, poster bot.Poster,
	configService config.Service, telemetry Telemetry) *ServiceImpl {
	return &ServiceImpl{
		pluginAPI:     pluginAPI,
		store:         store,
		poster:        poster,
		configService: configService,
		telemetry:     telemetry,
	}
}

// GetIncidents returns filtered incidents.
func (s *ServiceImpl) GetIncidents(options HeaderFilterOptions) ([]Incident, error) {
	return s.store.GetIncidents(options)
}

// CreateIncident creates a new incident.
func (s *ServiceImpl) CreateIncident(incdnt *Incident, public bool) (*Incident, error) {
	// Create incident
	incdnt, err := s.store.CreateIncident(incdnt)
	if err != nil {
		return nil, fmt.Errorf("failed to create incident: %w", err)
	}

	channel, err := s.createIncidentChannel(incdnt, public)
	if err != nil {
		return nil, err
	}

	// New incidents are always active
	incdnt.IsActive = true
	incdnt.PrimaryChannelID = channel.Id
	incdnt.CreatedAt = time.Now().Unix()

	// Start with a blank playbook with one empty checklist if one isn't provided
	if incdnt.Playbook == nil {
		incdnt.Playbook = &playbook.Playbook{
			Title: "Default Playbook",
			Checklists: []playbook.Checklist{
				{
					Title: "Checklist",
					Items: []playbook.ChecklistItem{},
				},
			},
		}
	}

	if err = s.store.UpdateIncident(incdnt); err != nil {
		return nil, fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incdnt, incdnt.TeamID)
	s.telemetry.CreateIncident(incdnt)

	user, err := s.pluginAPI.User.Get(incdnt.CommanderUserID)
	if err != nil {
		return nil, fmt.Errorf("failed to to resolve user %s: %w", incdnt.CommanderUserID, err)
	}

	if _, err = s.poster.PostMessage(channel.Id, "This incident has been started by @%s", user.Username); err != nil {
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

	if _, err := s.poster.PostMessage(channel.Id, postMessage); err != nil {
		return nil, fmt.Errorf("failed to post to incident channel: %w", err)
	}

	return incdnt, nil
}

// OpenCreateIncidentDialog opens a interactive dialog to start a new incident.
func (s *ServiceImpl) OpenCreateIncidentDialog(commanderID, triggerID, postID, clientID string, playbooks []playbook.Playbook) error {
	dialog, err := s.newIncidentDialog(commanderID, postID, clientID, playbooks)
	if err != nil {
		return fmt.Errorf("failed to create new incident dialog: %w", err)
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v1/incidents/create-dialog",
			s.configService.GetManifest().Id),
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

	// Close the incident
	incdnt.IsActive = false
	incdnt.EndedAt = time.Now().Unix()

	if err = s.store.UpdateIncident(incdnt); err != nil {
		return fmt.Errorf("failed to end incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incdnt, incdnt.TeamID)
	s.telemetry.EndIncident(incdnt)

	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return fmt.Errorf("failed to to resolve user %s: %w", userID, err)
	}

	// Post in the  main incident channel that @user has ended the incident.
	// Main channel is the only channel in the incident for now.
	if _, err := s.poster.PostMessage(incdnt.PrimaryChannelID, "This incident has been closed by @%v", user.Username); err != nil {
		return fmt.Errorf("failed to post end incident messsage: %w", err)
	}

	return nil
}

// OpenEndIncidentDialog opens a interactive dialog so the user can confirm an incident should
// be ended.
func (s *ServiceImpl) OpenEndIncidentDialog(incidentID string, triggerID string) error {
	dialog := model.Dialog{
		Title:            "Confirm End Incident",
		SubmitLabel:      "Confirm",
		IntroductionText: "The incident will become inactive and will be removed from the list. Incident history and post-mortem features are coming soon.",
		NotifyOnCancel:   false,
		State:            incidentID,
	}

	dialogRequest := model.OpenDialogRequest{
		URL: fmt.Sprintf("/plugins/%s/api/v1/incidents/end-dialog",
			s.configService.GetManifest().Id),
		Dialog:    dialog,
		TriggerId: triggerID,
	}

	if err := s.pluginAPI.Frontend.OpenInteractiveDialog(dialogRequest); err != nil {
		return fmt.Errorf("failed to open new incident dialog: %w", err)
	}

	return nil
}

// GetIncident gets an incident by ID. Returns error if it could not be found.
func (s *ServiceImpl) GetIncident(incidentID string) (*Incident, error) {
	return s.store.GetIncident(incidentID)
}

// GetIncidentIDForChannel get the incidentID associated with this channel. Returns an empty string
// if there is no incident associated with this channel.
func (s *ServiceImpl) GetIncidentIDForChannel(channelID string) string {
	incidentID, err := s.store.GetIncidentIDForChannel(channelID)
	if err != nil {
		return ""
	}
	return incidentID
}

// GetCommandersForTeam returns all the commanders of incidents in this team.
func (s *ServiceImpl) GetCommandersForTeam(teamID string) ([]CommanderInfo, error) {
	options := HeaderFilterOptions{TeamID: teamID}
	incidents, err := s.store.GetIncidents(options)
	if err != nil {
		return nil, err
	}

	// Set of commander ids
	commanders := make(map[string]bool)
	for _, h := range incidents {
		if _, ok := commanders[h.CommanderUserID]; !ok {
			commanders[h.CommanderUserID] = true
		}
	}

	var result []CommanderInfo
	for id := range commanders {
		c, err := s.pluginAPI.User.Get(id)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve commander id '%s': %w", id, err)
		}
		result = append(result, CommanderInfo{UserID: id, Username: c.Username})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Username < result[j].Username })

	return result, nil
}

// IsCommander returns true if the userID is the commander for incidentID.
func (s *ServiceImpl) IsCommander(incidentID string, userID string) bool {
	incdnt, err := s.store.GetIncident(incidentID)
	if err != nil {
		return false
	}
	return incdnt.CommanderUserID == userID
}

// ChangeCommander processes a request from userID to change the commander for incidentID
// to commanderID. Changing to the same commanderID is a no-op.
func (s *ServiceImpl) ChangeCommander(incidentID string, userID string, commanderID string) error {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return err
	}

	if !incidentToModify.IsActive {
		return ErrIncidentNotActive
	} else if incidentToModify.CommanderUserID == commanderID {
		return nil
	}

	oldCommander, err := s.pluginAPI.User.Get(incidentToModify.CommanderUserID)
	if err != nil {
		return fmt.Errorf("failed to to resolve user %s: %w", incidentToModify.CommanderUserID, err)
	}
	newCommander, err := s.pluginAPI.User.Get(commanderID)
	if err != nil {
		return fmt.Errorf("failed to to resolve user %s: %w", commanderID, err)
	}

	incidentToModify.CommanderUserID = commanderID
	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)

	mainChannelID := incidentToModify.PrimaryChannelID
	modifyMessage := fmt.Sprintf("changed the incident commander from @%s to @%s.",
		oldCommander.Username, newCommander.Username)
	if _, err := s.modificationMessage(userID, mainChannelID, modifyMessage); err != nil {
		return err
	}

	return nil
}

// ModifyCheckedState checks or unchecks the specified checklist item
// Indeponant, will not perform any actions if the checklist item is already in the given checked state
func (s *ServiceImpl) ModifyCheckedState(incidentID, userID string, newState bool, checklistNumber int, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	itemToCheck := incidentToModify.Playbook.Checklists[checklistNumber].Items[itemNumber]
	if newState == itemToCheck.Checked {
		return nil
	}

	// Send modification message before the actual modification becuase we need the postID
	// from the notification message.
	s.telemetry.ModifyCheckedState(incidentID, userID, newState)

	mainChannelID := incidentToModify.PrimaryChannelID
	modifyMessage := fmt.Sprintf("checked off checklist item \"%v\"", itemToCheck.Title)
	if !newState {
		modifyMessage = fmt.Sprintf("unchecked checklist item \"%v\"", itemToCheck.Title)
	}
	postID, err := s.modificationMessage(userID, mainChannelID, modifyMessage)
	if err != nil {
		return err
	}

	itemToCheck.Checked = newState
	itemToCheck.CheckedModified = time.Now()
	itemToCheck.CheckedPostID = postID
	incidentToModify.Playbook.Checklists[checklistNumber].Items[itemNumber] = itemToCheck

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident, is now in inconsistant state: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)

	return nil
}

// AddChecklistItem adds an item to the specified checklist
func (s *ServiceImpl) AddChecklistItem(incidentID, userID string, checklistNumber int, checklistItem playbook.ChecklistItem) error {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return err
	}

	incidentToModify.Playbook.Checklists[checklistNumber].Items = append(incidentToModify.Playbook.Checklists[checklistNumber].Items, checklistItem)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)
	s.telemetry.AddChecklistItem(incidentID, userID)

	return nil
}

// RemoveChecklistItem removes the item at the given index from the given checklist
func (s *ServiceImpl) RemoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	incidentToModify.Playbook.Checklists[checklistNumber].Items = append(incidentToModify.Playbook.Checklists[checklistNumber].Items[:itemNumber], incidentToModify.Playbook.Checklists[checklistNumber].Items[itemNumber+1:]...)

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)
	s.telemetry.RemoveChecklistItem(incidentID, userID)

	return nil
}

// RenameChecklistItem changes the title of a specified checklist item
func (s *ServiceImpl) RenameChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newTitle string) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	incidentToModify.Playbook.Checklists[checklistNumber].Items[itemNumber].Title = newTitle

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)
	s.telemetry.RenameChecklistItem(incidentID, userID)

	return nil
}

// MoveChecklistItem moves a checklist item to a new location
func (s *ServiceImpl) MoveChecklistItem(incidentID, userID string, checklistNumber int, itemNumber int, newLocation int) error {
	incidentToModify, err := s.checklistItemParamsVerify(incidentID, userID, checklistNumber, itemNumber)
	if err != nil {
		return err
	}

	if newLocation >= len(incidentToModify.Playbook.Checklists[checklistNumber].Items) {
		return errors.New("invalid targetNumber")
	}

	// Move item
	checklist := incidentToModify.Playbook.Checklists[checklistNumber].Items
	itemMoved := checklist[itemNumber]
	// Delete item to move
	checklist = append(checklist[:itemNumber], checklist[itemNumber+1:]...)
	// Insert item in new location
	checklist = append(checklist, playbook.ChecklistItem{})
	copy(checklist[newLocation+1:], checklist[newLocation:])
	checklist[newLocation] = itemMoved
	incidentToModify.Playbook.Checklists[checklistNumber].Items = checklist

	if err = s.store.UpdateIncident(incidentToModify); err != nil {
		return fmt.Errorf("failed to update incident: %w", err)
	}

	s.poster.PublishWebsocketEventToTeam(incidentUpdatedWSEvent, incidentToModify, incidentToModify.TeamID)
	s.telemetry.MoveChecklistItem(incidentID, userID)

	return nil
}

func (s *ServiceImpl) checklistParamsVerify(incidentID, userID string, checklistNumber int) (*Incident, error) {
	incidentToModify, err := s.store.GetIncident(incidentID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve incident: %w", err)
	}

	if !s.hasPermissionToModifyIncident(incidentToModify, userID) {
		return nil, errors.New("user does not have permission to modify incident")
	}

	if checklistNumber >= len(incidentToModify.Playbook.Checklists) {
		return nil, errors.New("invalid checklist number")
	}

	return incidentToModify, nil
}

func (s *ServiceImpl) modificationMessage(userID, channelID, message string) (string, error) {
	user, err := s.pluginAPI.User.Get(userID)
	if err != nil {
		return "", fmt.Errorf("failed to to resolve user %s: %w", userID, err)
	}

	postID, err := s.poster.PostMessage(channelID, user.Username+" "+message)
	if err != nil {
		return "", fmt.Errorf("failed to post end incident messsage: %w", err)
	}

	return postID, nil
}

func (s *ServiceImpl) checklistItemParamsVerify(incidentID, userID string, checklistNumber int, itemNumber int) (*Incident, error) {
	incidentToModify, err := s.checklistParamsVerify(incidentID, userID, checklistNumber)
	if err != nil {
		return nil, err
	}

	if itemNumber >= len(incidentToModify.Playbook.Checklists[checklistNumber].Items) {
		return nil, errors.New("invalid item number")
	}

	return incidentToModify, nil
}

// NukeDB removes all incident related data.
func (s *ServiceImpl) NukeDB() error {
	return s.store.NukeDB()
}

func (s *ServiceImpl) hasPermissionToModifyIncident(incident *Incident, userID string) bool {
	// Incident main channel membership is required to modify incident
	return s.pluginAPI.User.HasPermissionToChannel(userID, incident.PrimaryChannelID, model.PERMISSION_READ_CHANNEL)
}

func (s *ServiceImpl) createIncidentChannel(incdnt *Incident, public bool) (*model.Channel, error) {
	channelHeader := "The channel was created by the Incident Response plugin."

	if incdnt.PostID != "" {
		postURL := fmt.Sprintf("%s/_redirect/pl/%s", *s.pluginAPI.Configuration.GetConfig().ServiceSettings.SiteURL, incdnt.PostID)

		channelHeader = fmt.Sprintf("[Original Post](%s) | %s", postURL, channelHeader)
	}

	channelType := model.CHANNEL_PRIVATE
	if public {
		channelType = model.CHANNEL_OPEN
	}

	channel := &model.Channel{
		TeamId:      incdnt.TeamID,
		Type:        channelType,
		DisplayName: incdnt.Name,
		Name:        cleanChannelName(incdnt.Name),
		Header:      channelHeader,
	}

	// Prefer the channel name the user chose. But if it already exists, add some random bits
	// and try exactly once more.
	err := s.pluginAPI.Channel.Create(channel)
	if err != nil {
		if appErr, ok := err.(*model.AppError); ok {
			// Let the user correct display name errors:
			if appErr.Id == "model.channel.is_valid.display_name.app_error" ||
				appErr.Id == "model.channel.is_valid.2_or_more.app_error" {
				return nil, ErrChannelDisplayNameLong
			}

			// We can fix channel Name errors:
			if appErr.Id == "store.sql_channel.save_channel.exists.app_error" {
				channel.Name = addRandomBits(channel.Name)
				err = s.pluginAPI.Channel.Create(channel)
			}
		}

		if err != nil {
			return nil, fmt.Errorf("failed to create incident channel: %w", err)
		}
	}

	if _, err := s.pluginAPI.Channel.AddUser(channel.Id, incdnt.CommanderUserID, s.configService.GetConfiguration().BotUserID); err != nil {
		return nil, fmt.Errorf("failed to add user to channel: %w", err)
	}

	return channel, nil
}

func (s *ServiceImpl) newIncidentDialog(commanderID, postID, clientID string, playbooks []playbook.Playbook) (*model.Dialog, error) {
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

	options := []*model.PostActionOptions{{
		Text:  "None",
		Value: "-1",
	}}
	for _, playbook := range playbooks {
		options = append(options, &model.PostActionOptions{
			Text:  playbook.Title,
			Value: playbook.ID,
		})
	}

	return &model.Dialog{
		Title:            "Incident Details",
		IntroductionText: fmt.Sprintf("**Commander:** %v", getUserDisplayName(user)),
		Elements: []model.DialogElement{
			{
				DisplayName: "Channel Name",
				Name:        DialogFieldNameKey,
				Type:        "text",
				MinLength:   2,
				MaxLength:   64,
			},
			{
				DisplayName: "Incident Type",
				Name:        DialogFieldIsPublicKey,
				Type:        "radio",
				Default:     "private",
				Options: []*model.PostActionOptions{
					{
						Text:  "Private",
						Value: "private",
					},
					{
						Text:  "Public",
						Value: "public",
					},
				},
			},
			{
				DisplayName: "Playbook",
				Name:        DialogFieldPlaybookIDKey,
				Type:        "select",
				Options:     options,
				Optional:    true,
			},
		},
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
	// Change all dashes to whitespace, remove everything that's not a word or whitespace, all space becomes dashes
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
