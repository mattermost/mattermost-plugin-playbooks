package app

import (
	"reflect"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ErrLicensedFeature if the error is caused by the server not having the needed license for the feature
var ErrLicensedFeature = errors.New("not covered by current server license")

type LicenseChecker interface {
	PlaybookAllowed(isPlaybookPublic bool) bool
	RetrospectiveAllowed() bool
	TimelineAllowed() bool
	StatsAllowed() bool
}

type PermissionsService struct {
	playbookService PlaybookService
	runService      PlaybookRunService
	pluginAPI       *pluginapi.Client
	configService   config.Service
	licenseChecker  LicenseChecker
}

func NewPermissionsService(
	playbookService PlaybookService,
	runService PlaybookRunService,
	pluginAPI *pluginapi.Client,
	configService config.Service,
	licenseChecker LicenseChecker,
) *PermissionsService {
	return &PermissionsService{
		playbookService,
		runService,
		pluginAPI,
		configService,
		licenseChecker,
	}
}

func (p *PermissionsService) PlaybookIsPublic(playbook Playbook) bool {
	return playbook.Public
}

func (p *PermissionsService) getPlaybookRole(userID string, playbook Playbook) []string {
	for _, member := range playbook.Members {
		if member.UserID == userID {
			return member.SchemeRoles
		}
	}

	// Public playbooks
	if playbook.Public {
		if playbook.DefaultPlaybookMemberRole == "" {
			return []string{playbook.DefaultPlaybookMemberRole}
		}
		return []string{PlaybookRoleMember}
	}

	return []string{}
}

func (p *PermissionsService) getRunRole(userID string, run *PlaybookRun) []string {
	// For now, everyone with access to the channel is a run admin
	if p.pluginAPI.User.HasPermissionToChannel(userID, run.ChannelID, model.PermissionReadChannel) {
		return []string{RunRoleMember, RunRoleAdmin}
	}

	return []string{}
}

func (p *PermissionsService) hasPermissionsToPlaybook(userID string, playbook Playbook, permission *model.Permission) bool {
	// Check at playbook level
	if p.pluginAPI.User.RolesGrantPermission(p.getPlaybookRole(userID, playbook), permission.Id) {
		return true
	}

	// Cascade normally to higher level permissions
	return p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, permission)
}

func (p *PermissionsService) hasPermissionsToRun(userID string, run *PlaybookRun, permission *model.Permission) bool {
	// Check at run level
	if p.pluginAPI.User.RolesGrantPermission(p.getRunRole(userID, run), permission.Id) {
		return true
	}

	// Cascade normally to higher level permissions
	return p.pluginAPI.User.HasPermissionToTeam(userID, run.TeamID, permission)
}

func (p *PermissionsService) canViewTeam(userID string, teamID string) bool {
	if teamID == "" || userID == "" {
		return false
	}

	return p.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
}

func (p *PermissionsService) PlaybookCreate(userID string, playbook Playbook) error {
	if !p.licenseChecker.PlaybookAllowed(p.PlaybookIsPublic(playbook)) {
		return errors.Wrapf(ErrLicensedFeature, "the playbook is not valid with the current license")
	}

	// Check the user has permissions over all broadcast channels
	for _, channelID := range playbook.BroadcastChannelIDs {
		if !p.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
			return errors.Errorf("userID %s does not have permission to create posts in the channel %s", userID, channelID)
		}
	}

	// Check all invited users have permissions to the team.
	for _, userID := range playbook.InvitedUserIDs {
		if !p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PermissionViewTeam) {
			return errors.Errorf(
				"invited user with ID %s does not have permission to playbook's team %s",
				userID,
				playbook.TeamID,
			)
		}
	}

	// Respect setting for not allowing mentions of a group.
	for _, groupID := range playbook.InvitedGroupIDs {
		group, err := p.pluginAPI.Group.Get(groupID)
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

	// Check general permissions
	permission := model.PermissionPrivatePlaybookCreate
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookCreate
	}

	if p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, permission) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) PlaybookManageProperties(userID string, playbook Playbook) error {
	permission := model.PermissionPrivatePlaybookManageProperties
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookManageProperties
	}

	if p.hasPermissionsToPlaybook(userID, playbook, permission) {
		return nil
	}

	return ErrNoPermissions
}

// PlaybookodifyWithFixes checks both ManageProperties and ManageMembers permissions
// performs permissions checks that can be resolved though modification of the input.
// This function modifies the playbook argument.
func (p *PermissionsService) PlaybookModifyWithFixes(userID string, playbook *Playbook, oldPlaybook Playbook) error {
	// It is assumed that if you are calling this function there are properties changes
	// This means that you need the manage properties permission to manage members for now.
	if err := p.PlaybookManageProperties(userID, oldPlaybook); err != nil {
		return err
	}

	if err := p.noAddedBroadcastChannelsWithoutPermission(userID, *playbook, oldPlaybook); err != nil {
		return err
	}

	filteredUsers := []string{}
	for _, userID := range playbook.InvitedUserIDs {
		if !p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PermissionViewTeam) {
			p.pluginAPI.Log.Warn("user does not have permissions to playbook's team, removing from automated invite list", "teamID", playbook.TeamID, "userID", userID)
			continue
		}
		filteredUsers = append(filteredUsers, userID)
	}
	playbook.InvitedUserIDs = filteredUsers

	filteredGroups := []string{}
	for _, groupID := range playbook.InvitedGroupIDs {
		var group *model.Group
		group, err := p.pluginAPI.Group.Get(groupID)
		if err != nil {
			p.pluginAPI.Log.Warn("failed to query group", "group_id", groupID)
			continue
		}

		if !group.AllowReference {
			p.pluginAPI.Log.Warn("group does not allow references, removing from automated invite list", "group_id", groupID)
			continue
		}

		filteredGroups = append(filteredGroups, groupID)
	}
	playbook.InvitedGroupIDs = filteredGroups

	if playbook.DefaultOwnerID != "" {
		if !p.pluginAPI.User.HasPermissionToTeam(playbook.DefaultOwnerID, playbook.TeamID, model.PermissionViewTeam) {
			p.pluginAPI.Log.Warn("owner is not a member of the playbook's team, disabling default owner", "teamID", playbook.TeamID, "userID", playbook.DefaultOwnerID)
			playbook.DefaultOwnerID = ""
			playbook.DefaultOwnerEnabled = false
		}
	}

	// Check if we have changed members, if so check that permission.
	if !reflect.DeepEqual(oldPlaybook.Members, playbook.Members) {
		if err := p.PlaybookManageMembers(userID, oldPlaybook); err != nil {
			return errors.Wrap(err, "attempted to modify members without permissions")
		}
	}

	// Check if we have done a public conversion
	if oldPlaybook.Public != playbook.Public {
		if oldPlaybook.Public {
			if err := p.PlaybookMakePrivate(userID, oldPlaybook); err != nil {
				return errors.Wrap(err, "attempted to make playbook private without permissions")
			}
		} else {
			if err := p.PlaybookMakePublic(userID, oldPlaybook); err != nil {
				return errors.Wrap(err, "attempted to make playbook public without permissions")
			}
		}
	}

	if !p.licenseChecker.PlaybookAllowed(p.PlaybookIsPublic(*playbook)) {
		return errors.Wrapf(ErrLicensedFeature, "the playbook is not valid with the current license")
	}

	return nil
}

func (p *PermissionsService) DeletePlaybook(userID string, playbook Playbook) error {
	return p.PlaybookManageProperties(userID, playbook)
}

func (p *PermissionsService) noAddedBroadcastChannelsWithoutPermission(userID string, playbook, oldPlaybook Playbook) error {
	oldChannelsSet := make(map[string]bool)
	for _, channelID := range oldPlaybook.BroadcastChannelIDs {
		oldChannelsSet[channelID] = true
	}

	for _, channelID := range playbook.BroadcastChannelIDs {
		if !oldChannelsSet[channelID] &&
			!p.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
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

func (p *PermissionsService) PlaybookManageMembers(userID string, playbook Playbook) error {
	permission := model.PermissionPrivatePlaybookManageMembers
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookManageMembers
	}

	if p.hasPermissionsToPlaybook(userID, playbook, permission) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) PlaybookView(userID string, playbookID string) error {
	playbook, err := p.playbookService.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbook to determine permissions, playbook id `%s`", playbookID)
	}

	return p.PlaybookViewWithPlaybook(userID, playbook)
}

func (p *PermissionsService) PlaybookList(userID, teamID string) error {
	// Can list playbooks if you are on the team
	if p.canViewTeam(userID, teamID) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) PlaybookViewWithPlaybook(userID string, playbook Playbook) error {
	noAccessErr := errors.Wrapf(
		ErrNoPermissions,
		"userID %s to access playbook",
		userID,
	)

	// Playbooks are tied to teams. You must have permission to the team to have permission to the playbook.
	if !p.canViewTeam(userID, playbook.TeamID) {
		return errors.Wrap(noAccessErr, "no playbook access; no team view permission")
	}

	// If the playbook is public team access is enough to view
	if p.PlaybookIsPublic(playbook) {
		return nil
	}

	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPrivatePlaybookView) {
		return nil
	}

	return noAccessErr
}

func (p *PermissionsService) PlaybookMakePrivate(userID string, playbook Playbook) error {
	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPublicPlaybookMakePrivate) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) PlaybookMakePublic(userID string, playbook Playbook) error {
	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPrivatePlaybookMakePublic) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) RunCreate(userID string, playbook Playbook) error {
	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionRunCreate) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) RunManageProperties(userID, runID string) error {
	run, err := p.runService.GetPlaybookRun(runID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get run to determine permissions, run id `%s`", runID)
	}

	if p.hasPermissionsToRun(userID, run, model.PermissionRunManageProperties) {
		return nil
	}

	return ErrNoPermissions
}

func (p *PermissionsService) RunManagePropertiesByChannel(userID, channelID string) error {
	runID, err := p.runService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbookRunID to determine permissions, channel id `%s`", channelID)
	}

	return p.RunManageProperties(userID, runID)
}

func (p *PermissionsService) RunView(userID, runID string) error {
	run, err := p.runService.GetPlaybookRun(runID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get run to determine permissions, run id `%s`", runID)
	}

	// Has view permission if is in the channel
	if p.pluginAPI.User.HasPermissionToChannel(userID, run.ChannelID, model.PermissionReadChannel) {
		return nil
	}

	// Or has view access to the playbook that created it
	return p.PlaybookView(userID, run.PlaybookID)
}

func (p *PermissionsService) RunViewByChannel(userID, channelID string) error {
	runID, err := p.runService.GetPlaybookRunIDForChannel(channelID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbookRunID to determine permissions, channel id `%s`", channelID)
	}

	return p.RunView(userID, runID)
}

// IsSystemAdmin returns true if the userID is a system admin
func IsSystemAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem)
}

func CanPostToChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost)
}

func IsMemberOfTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	teamMember, err := pluginAPI.Team.GetMember(teamID, userID)
	if err != nil {
		return false
	}

	return teamMember.DeleteAt == 0
}

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID  string
	TeamID  string
	IsAdmin bool
	IsGuest bool
}

// IsGuest returns true if the userID is a system guest
func IsGuest(userID string, pluginAPI *pluginapi.Client) (bool, error) {
	user, err := pluginAPI.User.Get(userID)
	if err != nil {
		return false, errors.Wrapf(err, "Unable to get user to determine permissions, user id `%s`", userID)
	}

	return user.IsGuest(), nil
}

func GetRequesterInfo(userID string, pluginAPI *pluginapi.Client) (RequesterInfo, error) {
	isAdmin := IsSystemAdmin(userID, pluginAPI)

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
