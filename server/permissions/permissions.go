package permissions

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/config"
	"github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	"github.com/mattermost/mattermost-server/v5/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID  string
	IsAdmin bool
	IsGuest bool
}

// ViewIncident returns nil if the userID has permissions to view incidentID
func ViewIncident(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", channelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

// ViewIncidentFromChannelID returns nil if the userID has permissions to view the incident
// associated with channelID
func ViewIncidentFromChannelID(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", channelID)
	}

	if channel.Type == model.CHANNEL_OPEN && pluginAPI.User.HasPermissionToTeam(userID, channel.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return nil
	}

	return ErrNoPermissions
}

// EditIncident returns nil if the userID has permissions to edit incidentID
func EditIncident(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL) {
		return nil
	}

	return ErrNoPermissions
}

// CanViewTeam returns true if the userID has permissions to view teamID
func CanViewTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PERMISSION_VIEW_TEAM)
}

// IsAdmin returns true if the userID is a system admin
func IsAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PERMISSION_MANAGE_SYSTEM)
}

// IsGuest returns true if the userID is a system guest
func IsGuest(userID string, pluginAPI *pluginapi.Client) (bool, error) {
	user, err := pluginAPI.User.Get(userID)
	if err != nil {
		return false, errors.Wrapf(err, "Unable to get user to determine permissions, user id `%s`", userID)
	}

	return user.IsGuest(), nil
}

func MemberOfChannelID(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_READ_CHANNEL)
}

func CanPostToChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PERMISSION_CREATE_POST)
}

func GetRequesterInfo(userID string, pluginAPI *pluginapi.Client) (RequesterInfo, error) {
	isAdmin := IsAdmin(userID, pluginAPI)

	isGuest, err := IsGuest(userID, pluginAPI)
	if err != nil {
		return RequesterInfo{}, err
	}

	return RequesterInfo{
		UserID:  userID,
		IsAdmin: isAdmin,
		IsGuest: isGuest,
	}, nil
}

func IsMemberOfTeamID(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	teamMember, err := pluginAPI.Team.GetMember(teamID, userID)
	if err != nil {
		return false
	}

	return teamMember.DeleteAt == 0
}

var (
	ErrChannelNotFound          = errors.Errorf("channel not found")
	ErrChannelDeleted           = errors.Errorf("channel deleted")
	ErrChannelNotInExpectedTeam = errors.Errorf("channel in different team")
)

func IsChannelActiveInTeam(channelID string, expectedTeamID string, pluginAPI *pluginapi.Client) error {
	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return errors.Wrapf(ErrChannelNotFound, "channel with ID %s does not exist", channelID)
	}

	if channel.DeleteAt != 0 {
		return errors.Wrapf(ErrChannelDeleted, "channel with ID %s is archived", channelID)
	}

	if channel.TeamId != expectedTeamID {
		return errors.Wrapf(ErrChannelNotInExpectedTeam,
			"channel with ID %s is on team with ID %s; expected team ID is %s",
			channelID,
			channel.TeamId,
			expectedTeamID,
		)
	}

	return nil
}

func IsOnEnabledTeam(teamID string, cfgService config.Service) bool {
	enabledTeams := cfgService.GetConfiguration().EnabledTeams

	if len(enabledTeams) == 0 {
		return true
	}

	for _, enabledTeam := range enabledTeams {
		if enabledTeam == teamID {
			return true
		}
	}

	return false
}

func isPlaybookCreator(userID string, cfgService config.Service) error {
	playbookCreators := cfgService.GetConfiguration().PlaybookCreatorsUserIds
	if len(playbookCreators) == 0 {
		return nil
	}

	for _, candidateUserID := range playbookCreators {
		if userID == candidateUserID {
			return nil
		}
	}

	return errors.Wrap(ErrNoPermissions, "create playbooks")
}

func PlaybookAccess(userID string, pbook playbook.Playbook, pluginAPI *pluginapi.Client) error {
	noAccessErr := errors.Wrapf(
		ErrNoPermissions,
		"userID %s to access playbook",
		userID,
	)

	if !CanViewTeam(userID, pbook.TeamID, pluginAPI) {
		return errors.Wrap(noAccessErr, "no team view permission")
	}

	for _, memberID := range pbook.MemberIDs {
		if memberID == userID {
			return nil
		}
	}

	return errors.Wrap(noAccessErr, "not on list of members")
}

func CreatePlaybook(userID string, pbook playbook.Playbook, cfgService config.Service, pluginAPI *pluginapi.Client) error {
	if err := isPlaybookCreator(userID, cfgService); err != nil {
		return err
	}

	if !IsOnEnabledTeam(pbook.TeamID, cfgService) {
		return errors.Wrap(ErrNoPermissions, "not enabled on this team")
	}

	// Exclude guest users
	if isGuest, err := IsGuest(userID, pluginAPI); err != nil {
		return err
	} else if isGuest {
		return errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s because they are a guest",
			userID,
			pbook.TeamID,
		)
	}

	if pbook.BroadcastChannelID != "" &&
		!pluginAPI.User.HasPermissionToChannel(userID, pbook.BroadcastChannelID, model.PERMISSION_CREATE_POST) {
		return errors.Errorf(
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.BroadcastChannelID,
		)
	}

	if !CanViewTeam(userID, pbook.TeamID, pluginAPI) {
		return errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s",
			userID,
			pbook.TeamID,
		)
	}

	if pbook.AnnouncementChannelID != "" &&
		!pluginAPI.User.HasPermissionToChannel(userID, pbook.AnnouncementChannelID, model.PERMISSION_CREATE_POST) {
		return errors.Errorf(
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.AnnouncementChannelID,
		)
	}

	// Check all invited users have permissions to the team.
	for _, userID := range pbook.InvitedUserIDs {
		if !pluginAPI.User.HasPermissionToTeam(userID, pbook.TeamID, model.PERMISSION_VIEW_TEAM) {
			return errors.Errorf(
				"invited user with ID %s does not have permission to playbook's team %s",
				userID,
				pbook.TeamID,
			)
		}
	}

	for _, groupID := range pbook.InvitedGroupIDs {
		group, err := pluginAPI.Group.Get(groupID)
		if err != nil {
			return errors.Wrap(err, "invalid group")
		}

		if !group.AllowReference {
			return errors.Errorf(
				"group %s does not allow references",
				groupID,
			)
		}
	}

	return nil
}

// DANGER This is not a complete check. There is more in the current handler for updatePlaybook
// if you need to use this function, integrate that here first.
func PlaybookModify(userID string, pbook, oldPlaybook playbook.Playbook, pluginAPI *pluginapi.Client) error {
	if err := PlaybookAccess(userID, oldPlaybook, pluginAPI); err != nil {
		return err
	}

	if pbook.BroadcastChannelID != "" &&
		pbook.BroadcastChannelID != oldPlaybook.BroadcastChannelID &&
		!pluginAPI.User.HasPermissionToChannel(userID, pbook.BroadcastChannelID, model.PERMISSION_CREATE_POST) {
		return errors.Wrapf(
			ErrNoPermissions,
			"userID %s does not have permission to create posts in the channel %s",
			userID,
			pbook.BroadcastChannelID,
		)
	}

	return nil
}

func ModifySettings(userID string, config config.Service) error {
	cfg := config.GetConfiguration()
	if len(cfg.PlaybookCreatorsUserIds) > 0 {
		found := false
		for _, candidateUserID := range cfg.PlaybookCreatorsUserIds {
			if candidateUserID == userID {
				found = true
				break
			}
		}

		if !found {
			return errors.Wrap(ErrNoPermissions, "not a playbook creator")
		}
	}

	return nil
}
