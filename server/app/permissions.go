package app

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/v2/server/config"
	"github.com/mattermost/mattermost-server/v6/model"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ErrLicensedFeature if the error is caused by the server not having the needed license for the feature
var ErrLicensedFeature = errors.New("not covered by current server license")

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID  string
	TeamID  string
	IsAdmin bool
	IsGuest bool
}

// UserCanViewPlaybookRun returns nil if the userID has permissions to view the playbook run
// associated with playbookRunID
func UserCanViewPlaybookRun(userID, playbookRunID string, playbookService PlaybookService, playbookRunService PlaybookRunService, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	playbookRun, err := playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbookRun to determine permissions, playbookRun id `%s`", playbookRunID)
	}

	if pluginAPI.User.HasPermissionToChannel(userID, playbookRun.ChannelID, model.PermissionReadChannel) {
		return nil
	}

	return PlaybookAccess(userID, playbookRun.PlaybookID, playbookService, pluginAPI)
}

// UserCanViewPlaybookRunFromChannelID returns nil if the userID has permissions to view the playbook run
// associated with channelID
func UserCanViewPlaybookRunFromChannelID(userID, channelID string, playbookService PlaybookService, playbookRunService PlaybookRunService, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		return nil
	}

	playbookRunID, err := playbookRunService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbookRunID to determine permissions, channel id `%s`", channelID)
	}

	playbookRun, err := playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get channel to determine permissions, channel id `%s`", channelID)
	}

	return PlaybookAccess(userID, playbookRun.PlaybookID, playbookService, pluginAPI)
}

// EditPlaybookRun returns nil if the userID has permissions to edit channelID
func EditPlaybookRun(userID, channelID string, pluginAPI *pluginapi.Client) error {
	if pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	if pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		return nil
	}

	return ErrNoPermissions
}

// CanViewTeam returns true if the userID has permissions to view teamID
func CanViewTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
}

// IsAdmin returns true if the userID is a system admin
func IsAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem)
}

// IsGuest returns true if the userID is a system guest
func IsGuest(userID string, pluginAPI *pluginapi.Client) (bool, error) {
	user, err := pluginAPI.User.Get(userID)
	if err != nil {
		return false, errors.Wrapf(err, "Unable to get user to determine permissions, user id `%s`", userID)
	}

	return user.IsGuest(), nil
}

func IsMemberOfChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel)
}

func CanPostToChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost)
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

func IsMemberOfTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
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

func PlaybookAccess(userID string, playbookID string, playbookService PlaybookService, pluginAPI *pluginapi.Client) error {
	noAccessErr := errors.Wrapf(
		ErrNoPermissions,
		"userID %s to access playbook %s",
		userID,
		playbookID,
	)

	playbook, err := playbookService.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbook to determine permissions, playbook id `%s`", playbookID)
	}

	if !CanViewTeam(userID, playbook.TeamID, pluginAPI) {
		return errors.Wrapf(noAccessErr, "no playbook access; no team view permission for team %s", playbook.TeamID)
	}

	// If the list of members is empty then the playbook is open for all.
	if len(playbook.MemberIDs) == 0 {
		return nil
	}

	for _, memberID := range playbook.MemberIDs {
		if memberID == userID {
			return nil
		}
	}

	return errors.Wrap(noAccessErr, "no playbook access; not on list of playbook members")
}

// checkPlaybookIsNotUsingE20Features features returns a non-nil error if the playbook is using E20 features
func checkPlaybookIsNotUsingE20Features(playbook Playbook) error {
	if len(playbook.MemberIDs) > 0 {
		return errors.Wrap(ErrLicensedFeature, "restricting playbook editing to specific users is not available with your current subscription")
	}

	return nil
}

// checkPlaybookIsNotUsingE10Features features returns a non-nil error if the playbook is using E10 features
func checkPlaybookIsNotUsingE10Features(playbook Playbook, playbookService PlaybookService) error {
	num, err := playbookService.GetNumPlaybooksForTeam(playbook.TeamID)
	if err != nil {
		return err
	}

	if num > 0 {
		return errors.Wrap(ErrLicensedFeature, "creating more than one playbook per team is not available with your current subscription")
	}

	return nil
}

func PlaybookLicensedFeatures(playbook Playbook, cfgService config.Service, playbookService PlaybookService) error {
	if cfgService.IsAtLeastE20Licensed() {
		return nil
	}

	if err := checkPlaybookIsNotUsingE20Features(playbook); err != nil {
		return err
	}

	if cfgService.IsAtLeastE10Licensed() {
		return nil
	}

	return checkPlaybookIsNotUsingE10Features(playbook, playbookService)
}

func CreatePlaybook(userID string, playbook Playbook, cfgService config.Service, pluginAPI *pluginapi.Client, playbookService PlaybookService) error {
	if err := isPlaybookCreator(userID, cfgService); err != nil {
		return err
	}

	if err := PlaybookLicensedFeatures(playbook, cfgService, playbookService); err != nil {
		return err
	}

	// Exclude guest users
	if isGuest, err := IsGuest(userID, pluginAPI); err != nil {
		return err
	} else if isGuest {
		return errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s because they are a guest",
			userID,
			playbook.TeamID,
		)
	}

	if !CanViewTeam(userID, playbook.TeamID, pluginAPI) {
		return errors.Errorf(
			"userID %s does not have permission to create playbook on teamID %s",
			userID,
			playbook.TeamID,
		)
	}

	// Check the user has permissions over all broadcast channels
	for _, channelID := range playbook.BroadcastChannelIDs {
		if !pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
			return errors.Errorf("userID %s does not have permission to create posts in the channel %s", userID, channelID)
		}
	}

	// Check all invited users have permissions to the team.
	for _, userID := range playbook.InvitedUserIDs {
		if !pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PermissionViewTeam) {
			return errors.Errorf(
				"invited user with ID %s does not have permission to playbook's team %s",
				userID,
				playbook.TeamID,
			)
		}
	}

	for _, groupID := range playbook.InvitedGroupIDs {
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
func PlaybookModify(userID string, playbook, oldPlaybook Playbook, cfgService config.Service, pluginAPI *pluginapi.Client, playbookService PlaybookService) error {
	if err := PlaybookAccess(userID, oldPlaybook.ID, playbookService, pluginAPI); err != nil {
		return err
	}

	oldChannelsSet := make(map[string]bool)
	for _, channelID := range oldPlaybook.BroadcastChannelIDs {
		oldChannelsSet[channelID] = true
	}

	for _, channelID := range playbook.BroadcastChannelIDs {
		if !oldChannelsSet[channelID] &&
			!pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
			return errors.Wrapf(
				ErrNoPermissions,
				"userID %s does not have permission to create posts in the channel %s",
				userID,
				channelID,
			)
		}
	}

	return nil
}

func ModifyPlaybookCreators(userID string, isAdmin bool, config config.Service) error {
	// Admins are always allowed to modify settings.
	if isAdmin {
		return nil
	}

	cfg := config.GetConfiguration()

	// Only admins are allowed to initially modify the settings.
	if len(cfg.PlaybookCreatorsUserIds) == 0 {
		return errors.Wrap(ErrNoPermissions, "only system admins may initially constrain playbook creators")
	}

	for _, candidateUserID := range cfg.PlaybookCreatorsUserIds {
		if candidateUserID == userID {
			return nil
		}
	}

	return errors.Wrap(ErrNoPermissions, "not a playbook creator")
}

func CanStartTrialLicense(userID string, pluginAPI *pluginapi.Client) error {
	if !pluginAPI.User.HasPermissionTo(userID, model.PermissionManageLicenseInformation) {
		return errors.Wrap(ErrNoPermissions, "no permission to manage license information")
	}

	return nil
}
