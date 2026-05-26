// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// permissionsTestFixture wires up a PermissionsService with a configurable
// plugintest.API so tests can assert behavior of PlaybookEdit, IsPlaybookAdmin,
// and PlaybookModifyWithFixes without standing up the full app stack.
type permissionsTestFixture struct {
	api *plugintest.API
	svc *PermissionsService
}

// allowAllLicenseChecker is a LicenseChecker stub that permits all features.
type allowAllLicenseChecker struct{}

func (allowAllLicenseChecker) PlaybookAllowed(_ bool) bool       { return true }
func (allowAllLicenseChecker) RetrospectiveAllowed() bool        { return true }
func (allowAllLicenseChecker) TimelineAllowed() bool             { return true }
func (allowAllLicenseChecker) StatsAllowed() bool                { return true }
func (allowAllLicenseChecker) ChecklistItemDueDateAllowed() bool { return true }
func (allowAllLicenseChecker) PlaybookAttributesAllowed() bool   { return true }
func (allowAllLicenseChecker) ConditionalPlaybooksAllowed() bool { return true }

func newPermissionsFixture(t *testing.T) *permissionsTestFixture {
	t.Helper()
	api := &plugintest.API{}
	svc := &PermissionsService{
		pluginAPI:      pluginapi.NewClient(api, nil),
		licenseChecker: allowAllLicenseChecker{},
	}
	t.Cleanup(func() { api.AssertExpectations(t) })
	return &permissionsTestFixture{api: api, svc: svc}
}

// allowSysadmin marks userID as a system admin (HasPermissionTo ManageSystem == true).
func (f *permissionsTestFixture) allowSysadmin(userID string) {
	f.api.On("HasPermissionTo", userID, model.PermissionManageSystem).Return(true).Maybe()
}

// denySysadmin marks userID as not a system admin.
func (f *permissionsTestFixture) denySysadmin(userID string) {
	f.api.On("HasPermissionTo", userID, model.PermissionManageSystem).Return(false).Maybe()
}

// allowTeamView lets userID pass canViewTeam (PermissionViewTeam) but denies any
// other team-scoped permission, so getPlaybookRole's public-playbook fallback
// (which checks PermissionListTeamChannels) doesn't grant a default role.
func (f *permissionsTestFixture) allowTeamView(userID, teamID string) {
	f.api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true).Maybe()
	f.api.On("HasPermissionToTeam", userID, teamID, mock.Anything).Return(false).Maybe()
}

// denyTeamView blocks userID's team view (forces the no-team-access branch).
func (f *permissionsTestFixture) denyTeamView(userID, teamID string) {
	f.api.On("HasPermissionToTeam", userID, teamID, mock.Anything).Return(false).Maybe()
}

func TestPlaybookEdit(t *testing.T) {
	const (
		teamID     = "team-1"
		playbookID = "pb-1"
		sysadminID = "u-sysadmin"
		adminID    = "u-pb-admin"
		memberID   = "u-pb-member"
		strangerID = "u-stranger"
	)

	makePlaybook := func(adminOnly bool, members []PlaybookMember) Playbook {
		return Playbook{
			ID:                       playbookID,
			TeamID:                   teamID,
			Public:                   true,
			AdminOnlyEdit:            adminOnly,
			DefaultPlaybookAdminRole: PlaybookRoleAdmin,
			Members:                  members,
		}
	}

	t.Run("AdminOnlyEdit=true sysadmin allowed without team membership", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.allowSysadmin(sysadminID)

		err := f.svc.PlaybookEdit(sysadminID, makePlaybook(true, nil))
		assert.NoError(t, err)
	})

	t.Run("AdminOnlyEdit=true denies user without team access", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(strangerID)
		f.denyTeamView(strangerID, teamID)

		err := f.svc.PlaybookEdit(strangerID, makePlaybook(true, nil))
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "no team access")
	})

	t.Run("AdminOnlyEdit=true allows playbook admin member", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)

		pb := makePlaybook(true, []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		})

		err := f.svc.PlaybookEdit(adminID, pb)
		assert.NoError(t, err)
	})

	t.Run("AdminOnlyEdit=true denies plain member without admin role", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(memberID)
		f.allowTeamView(memberID, teamID)

		pb := makePlaybook(true, []PlaybookMember{
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
		})

		err := f.svc.PlaybookEdit(memberID, pb)
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "admin-only")
	})

	t.Run("AdminOnlyEdit=true denies non-member who has team access", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(strangerID)
		f.allowTeamView(strangerID, teamID)

		// Empty Members slice — stranger is not a member of any role.
		err := f.svc.PlaybookEdit(strangerID, makePlaybook(true, nil))
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "admin-only")
	})

	t.Run("AdminOnlyEdit=true with empty DefaultPlaybookAdminRole falls back to PlaybookRoleAdmin", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)

		pb := Playbook{
			ID:                       playbookID,
			TeamID:                   teamID,
			Public:                   true,
			AdminOnlyEdit:            true,
			DefaultPlaybookAdminRole: "", // empty — must fall back to PlaybookRoleAdmin
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}

		err := f.svc.PlaybookEdit(adminID, pb)
		assert.NoError(t, err)
	})

	t.Run("AdminOnlyEdit=true denies admin-role member who has lost team access", func(t *testing.T) {
		// User was added as a playbook admin and later removed from the team.
		// PlaybookEdit must fail-closed: holding the role in Members is not enough
		// once team access is gone. Sysadmin path is independent and not exercised here.
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.denyTeamView(adminID, teamID)

		pb := makePlaybook(true, []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		})

		err := f.svc.PlaybookEdit(adminID, pb)
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "no team access")
	})

	t.Run("AdminOnlyEdit=true respects custom DefaultPlaybookAdminRole", func(t *testing.T) {
		const customRole = "playbook_admin_custom"

		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)

		pb := Playbook{
			ID:                       playbookID,
			TeamID:                   teamID,
			Public:                   true,
			AdminOnlyEdit:            true,
			DefaultPlaybookAdminRole: customRole,
			Members: []PlaybookMember{
				// Member holds PlaybookRoleAdmin but NOT the custom role — should be denied.
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}

		err := f.svc.PlaybookEdit(adminID, pb)
		assert.ErrorIs(t, err, ErrNoPermissions, "holding the default admin role must not satisfy a custom DefaultPlaybookAdminRole")

		// Now the same user holds the custom role — should be allowed.
		pb.Members = []PlaybookMember{{UserID: adminID, SchemeRoles: []string{customRole}}}
		err = f.svc.PlaybookEdit(adminID, pb)
		assert.NoError(t, err)
	})
}

func TestIsPlaybookAdmin_DefaultAdminRole(t *testing.T) {
	const (
		teamID  = "team-1"
		userID  = "u-1"
		otherID = "u-2"
	)

	makeFixture := func(t *testing.T, allowTeam bool) *permissionsTestFixture {
		f := newPermissionsFixture(t)
		if allowTeam {
			f.allowTeamView(userID, teamID)
			f.allowTeamView(otherID, teamID)
		} else {
			f.denyTeamView(userID, teamID)
		}
		return f
	}

	t.Run("member with admin role returns true", func(t *testing.T) {
		f := makeFixture(t, true)
		pb := Playbook{
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: userID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
			},
		}
		assert.True(t, f.svc.IsPlaybookAdmin(userID, pb))
	})

	t.Run("member without admin role returns false", func(t *testing.T) {
		f := makeFixture(t, true)
		pb := Playbook{
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: userID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
		assert.False(t, f.svc.IsPlaybookAdmin(userID, pb))
	})

	t.Run("non-member returns false even when other members are admins", func(t *testing.T) {
		f := makeFixture(t, true)
		pb := Playbook{
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: otherID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}
		assert.False(t, f.svc.IsPlaybookAdmin(userID, pb))
	})

	t.Run("user without team access returns false even with admin role", func(t *testing.T) {
		f := makeFixture(t, false)
		pb := Playbook{
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: userID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}
		assert.False(t, f.svc.IsPlaybookAdmin(userID, pb))
	})

	t.Run("custom DefaultPlaybookAdminRole is required, fallback role is not enough", func(t *testing.T) {
		f := makeFixture(t, true)
		pb := Playbook{
			TeamID:                   teamID,
			DefaultPlaybookAdminRole: "custom_role",
			Members: []PlaybookMember{
				{UserID: userID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}
		assert.False(t, f.svc.IsPlaybookAdmin(userID, pb))
	})

	t.Run("empty DefaultPlaybookAdminRole falls back to PlaybookRoleAdmin", func(t *testing.T) {
		f := makeFixture(t, true)
		pb := Playbook{
			TeamID:                   teamID,
			DefaultPlaybookAdminRole: "",
			Members: []PlaybookMember{
				{UserID: userID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}
		assert.True(t, f.svc.IsPlaybookAdmin(userID, pb))
	})
}

func TestPlaybookModifyWithFixes_AdminOnlyEditFlip(t *testing.T) {
	const (
		teamID     = "team-1"
		playbookID = "pb-1"
		sysadminID = "u-sysadmin"
		adminID    = "u-pb-admin"
		memberID   = "u-pb-member"
	)

	makePlaybook := func(adminOnly bool, members []PlaybookMember) Playbook {
		return Playbook{
			ID:                       playbookID,
			TeamID:                   teamID,
			Public:                   true,
			AdminOnlyEdit:            adminOnly,
			DefaultPlaybookAdminRole: PlaybookRoleAdmin,
			Members:                  members,
		}
	}

	t.Run("system admin can flip the flag", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.allowSysadmin(sysadminID)

		old := makePlaybook(true, nil)
		updated := makePlaybook(false, nil)
		assert.NoError(t, f.svc.PlaybookModifyWithFixes(sysadminID, &updated, old))
	})

	t.Run("playbook admin can enable (OFF→ON)", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)
		// PlaybookEdit → PlaybookManageProperties → hasPermissionsToPlaybook → RolesGrantPermission.
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(true).Maybe()

		old := makePlaybook(false, []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		})
		updated := makePlaybook(true, old.Members)
		assert.NoError(t, f.svc.PlaybookModifyWithFixes(adminID, &updated, old))
	})

	t.Run("playbook admin can disable (ON→OFF)", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)

		old := makePlaybook(true, []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		})
		updated := makePlaybook(false, old.Members)
		assert.NoError(t, f.svc.PlaybookModifyWithFixes(adminID, &updated, old))
	})

	t.Run("admin-role member who has lost team access is denied", func(t *testing.T) {
		// Compliance-style scenario: user was a playbook admin, later removed from the team.
		// Their Members entry still carries the admin role, but PlaybookEdit fails-closed.
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.denyTeamView(adminID, teamID)

		old := makePlaybook(true, []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
		})
		updated := makePlaybook(false, old.Members)
		err := f.svc.PlaybookModifyWithFixes(adminID, &updated, old)
		assert.ErrorIs(t, err, ErrNoPermissions)
	})

	t.Run("plain member cannot flip the flag even when they can otherwise edit", func(t *testing.T) {
		// Member has PlaybookManageProperties (AdminOnlyEdit=false path) but not the flip gate.
		f := newPermissionsFixture(t)
		f.denySysadmin(memberID)
		f.allowTeamView(memberID, teamID)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(true).Maybe()

		old := makePlaybook(false, []PlaybookMember{
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
		})
		updated := makePlaybook(true, old.Members)
		err := f.svc.PlaybookModifyWithFixes(memberID, &updated, old)
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "admin_only_edit")
	})
}

// ---------------------------------------------------------------------------
// stubRunService — minimal implementation of PlaybookRunService.
// Only GetPlaybookRun is exercised by the permission helpers.
// All other methods panic to catch accidental calls during testing.
// ---------------------------------------------------------------------------

type stubRunService struct {
	run *PlaybookRun
	err error
}

func (s *stubRunService) GetPlaybookRun(playbookRunID string) (*PlaybookRun, error) {
	return s.run, s.err
}

func (s *stubRunService) GetPlaybookRuns(RequesterInfo, PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error) {
	panic("stubRunService: GetPlaybookRuns not implemented")
}
func (s *stubRunService) CreatePlaybookRun(*PlaybookRun, *Playbook, string, bool, string, map[string]json.RawMessage) (*PlaybookRun, error) {
	panic("stubRunService: CreatePlaybookRun not implemented")
}
func (s *stubRunService) OpenCreatePlaybookRunDialog(string, string, string, string, string, []Playbook) error {
	panic("stubRunService: OpenCreatePlaybookRunDialog not implemented")
}
func (s *stubRunService) OpenUpdateStatusDialog(string, string, string) error {
	panic("stubRunService: OpenUpdateStatusDialog not implemented")
}
func (s *stubRunService) OpenAddToTimelineDialog(RequesterInfo, string, string, string) error {
	panic("stubRunService: OpenAddToTimelineDialog not implemented")
}
func (s *stubRunService) OpenAddChecklistItemDialog(string, string, string, int) error {
	panic("stubRunService: OpenAddChecklistItemDialog not implemented")
}
func (s *stubRunService) AddPostToTimeline(*PlaybookRun, string, *model.Post, string) error {
	panic("stubRunService: AddPostToTimeline not implemented")
}
func (s *stubRunService) RemoveTimelineEvent(string, string, string) error {
	panic("stubRunService: RemoveTimelineEvent not implemented")
}
func (s *stubRunService) UpdateStatus(string, string, StatusUpdateOptions) error {
	panic("stubRunService: UpdateStatus not implemented")
}
func (s *stubRunService) OpenFinishPlaybookRunDialog(string, string, string) error {
	panic("stubRunService: OpenFinishPlaybookRunDialog not implemented")
}
func (s *stubRunService) FinishPlaybookRun(string, string) error {
	panic("stubRunService: FinishPlaybookRun not implemented")
}
func (s *stubRunService) ToggleStatusUpdates(string, string, bool) error {
	panic("stubRunService: ToggleStatusUpdates not implemented")
}
func (s *stubRunService) SetRunPropertyValue(string, string, string, json.RawMessage) (*PropertyValue, error) {
	panic("stubRunService: SetRunPropertyValue not implemented")
}
func (s *stubRunService) GetPlaybookRunMetadata(string, bool) (*Metadata, error) {
	panic("stubRunService: GetPlaybookRunMetadata not implemented")
}
func (s *stubRunService) GetPlaybookRunsForChannelByUser(string, string) ([]PlaybookRun, error) {
	panic("stubRunService: GetPlaybookRunsForChannelByUser not implemented")
}
func (s *stubRunService) GetOwners(RequesterInfo, PlaybookRunFilterOptions) ([]OwnerInfo, error) {
	panic("stubRunService: GetOwners not implemented")
}
func (s *stubRunService) IsOwner(string, string) bool {
	panic("stubRunService: IsOwner not implemented")
}
func (s *stubRunService) ChangeOwner(string, string, string) error {
	panic("stubRunService: ChangeOwner not implemented")
}
func (s *stubRunService) ModifyCheckedState(string, string, string, int, int) error {
	panic("stubRunService: ModifyCheckedState not implemented")
}
func (s *stubRunService) ToggleCheckedState(string, string, int, int) error {
	panic("stubRunService: ToggleCheckedState not implemented")
}
func (s *stubRunService) SetAssignee(string, string, string, int, int) error {
	panic("stubRunService: SetAssignee not implemented")
}
func (s *stubRunService) SetGroupAssignee(string, string, string, int, int) error {
	panic("stubRunService: SetGroupAssignee not implemented")
}
func (s *stubRunService) SetRoleAssignee(string, string, string, int, int) error {
	panic("stubRunService: SetRoleAssignee not implemented")
}
func (s *stubRunService) SetPropertyUserAssignee(string, string, int, int, string) error {
	panic("stubRunService: SetPropertyUserAssignee not implemented")
}
func (s *stubRunService) SetCommandToChecklistItem(string, string, int, int, string) error {
	panic("stubRunService: SetCommandToChecklistItem not implemented")
}
func (s *stubRunService) SetDueDate(string, string, int64, int, int) error {
	panic("stubRunService: SetDueDate not implemented")
}
func (s *stubRunService) SetTaskActionsToChecklistItem(string, string, int, int, []TaskAction) error {
	panic("stubRunService: SetTaskActionsToChecklistItem not implemented")
}
func (s *stubRunService) RunChecklistItemSlashCommand(string, string, int, int) (string, error) {
	panic("stubRunService: RunChecklistItemSlashCommand not implemented")
}
func (s *stubRunService) DuplicateChecklistItem(string, string, int, int) error {
	panic("stubRunService: DuplicateChecklistItem not implemented")
}
func (s *stubRunService) AddChecklistItem(string, string, int, ChecklistItem) error {
	panic("stubRunService: AddChecklistItem not implemented")
}
func (s *stubRunService) RemoveChecklistItem(string, string, int, int) error {
	panic("stubRunService: RemoveChecklistItem not implemented")
}
func (s *stubRunService) DuplicateChecklist(string, string, int) error {
	panic("stubRunService: DuplicateChecklist not implemented")
}
func (s *stubRunService) SkipChecklist(string, string, int) error {
	panic("stubRunService: SkipChecklist not implemented")
}
func (s *stubRunService) RestoreChecklist(string, string, int) error {
	panic("stubRunService: RestoreChecklist not implemented")
}
func (s *stubRunService) SkipChecklistItem(string, string, int, int) error {
	panic("stubRunService: SkipChecklistItem not implemented")
}
func (s *stubRunService) RestoreChecklistItem(string, string, int, int) error {
	panic("stubRunService: RestoreChecklistItem not implemented")
}
func (s *stubRunService) EditChecklistItem(string, string, int, int, string, string, string) error {
	panic("stubRunService: EditChecklistItem not implemented")
}
func (s *stubRunService) MoveChecklist(string, string, int, int) error {
	panic("stubRunService: MoveChecklist not implemented")
}
func (s *stubRunService) MoveChecklistItem(string, string, int, int, int, int) error {
	panic("stubRunService: MoveChecklistItem not implemented")
}
func (s *stubRunService) GetChecklistItemAutocomplete([]PlaybookRun) ([]model.AutocompleteListItem, error) {
	panic("stubRunService: GetChecklistItemAutocomplete not implemented")
}
func (s *stubRunService) GetChecklistAutocomplete([]PlaybookRun) ([]model.AutocompleteListItem, error) {
	panic("stubRunService: GetChecklistAutocomplete not implemented")
}
func (s *stubRunService) GetRunsAutocomplete([]PlaybookRun) ([]model.AutocompleteListItem, error) {
	panic("stubRunService: GetRunsAutocomplete not implemented")
}
func (s *stubRunService) AddChecklist(string, string, Checklist) error {
	panic("stubRunService: AddChecklist not implemented")
}
func (s *stubRunService) RemoveChecklist(string, string, int) error {
	panic("stubRunService: RemoveChecklist not implemented")
}
func (s *stubRunService) RenameChecklist(string, string, int, string) error {
	panic("stubRunService: RenameChecklist not implemented")
}
func (s *stubRunService) NukeDB() error {
	panic("stubRunService: NukeDB not implemented")
}
func (s *stubRunService) SetReminder(string, time.Duration) error {
	panic("stubRunService: SetReminder not implemented")
}
func (s *stubRunService) RemoveReminder(string) {
	panic("stubRunService: RemoveReminder not implemented")
}
func (s *stubRunService) HandleReminder(string, any) {
	panic("stubRunService: HandleReminder not implemented")
}
func (s *stubRunService) SetNewReminder(string, time.Duration) error {
	panic("stubRunService: SetNewReminder not implemented")
}
func (s *stubRunService) ResetReminder(string, time.Duration) error {
	panic("stubRunService: ResetReminder not implemented")
}
func (s *stubRunService) ChangeCreationDate(string, time.Time) error {
	panic("stubRunService: ChangeCreationDate not implemented")
}
func (s *stubRunService) UpdateRetrospective(string, string, RetrospectiveUpdate) error {
	panic("stubRunService: UpdateRetrospective not implemented")
}
func (s *stubRunService) PublishRetrospective(string, string, RetrospectiveUpdate) error {
	panic("stubRunService: PublishRetrospective not implemented")
}
func (s *stubRunService) CancelRetrospective(string, string) error {
	panic("stubRunService: CancelRetrospective not implemented")
}
func (s *stubRunService) EphemeralPostTodoDigestToUser(string, string, bool, bool) error {
	panic("stubRunService: EphemeralPostTodoDigestToUser not implemented")
}
func (s *stubRunService) DMTodoDigestToUser(string, bool, bool) error {
	panic("stubRunService: DMTodoDigestToUser not implemented")
}
func (s *stubRunService) GetRunsWithAssignedTasks(string) ([]AssignedRun, error) {
	panic("stubRunService: GetRunsWithAssignedTasks not implemented")
}
func (s *stubRunService) GetParticipatingRuns(string) ([]RunLink, error) {
	panic("stubRunService: GetParticipatingRuns not implemented")
}
func (s *stubRunService) GetOverdueUpdateRuns(string) ([]RunLink, error) {
	panic("stubRunService: GetOverdueUpdateRuns not implemented")
}
func (s *stubRunService) Follow(string, string) error {
	panic("stubRunService: Follow not implemented")
}
func (s *stubRunService) Unfollow(string, string) error {
	panic("stubRunService: Unfollow not implemented")
}
func (s *stubRunService) UnfollowMultiple(string, []string) error {
	panic("stubRunService: UnfollowMultiple not implemented")
}
func (s *stubRunService) GetFollowers(string) ([]string, error) {
	panic("stubRunService: GetFollowers not implemented")
}
func (s *stubRunService) RestorePlaybookRun(string, string) error {
	panic("stubRunService: RestorePlaybookRun not implemented")
}
func (s *stubRunService) RequestUpdate(string, string) error {
	panic("stubRunService: RequestUpdate not implemented")
}
func (s *stubRunService) RequestJoinChannel(string, string) error {
	panic("stubRunService: RequestJoinChannel not implemented")
}
func (s *stubRunService) RemoveParticipants(string, []string, string) error {
	panic("stubRunService: RemoveParticipants not implemented")
}
func (s *stubRunService) AddParticipants(string, []string, string, bool, bool) error {
	panic("stubRunService: AddParticipants not implemented")
}
func (s *stubRunService) GetPlaybookRunIDsForUser(string) ([]string, error) {
	panic("stubRunService: GetPlaybookRunIDsForUser not implemented")
}
func (s *stubRunService) GraphqlUpdate(string, map[string]interface{}) error {
	panic("stubRunService: GraphqlUpdate not implemented")
}
func (s *stubRunService) MessageHasBeenPosted(*model.Post) {
	panic("stubRunService: MessageHasBeenPosted not implemented")
}
func (s *stubRunService) ResolveRunCreationParams(*PlaybookRun, *Playbook, map[string]json.RawMessage, string) error {
	panic("stubRunService: ResolveRunCreationParams not implemented")
}
func (s *stubRunService) ToggleRetrospectiveEnabled(string, string, bool) error {
	panic("stubRunService: ToggleRetrospectiveEnabled not implemented")
}

// ---------------------------------------------------------------------------
// stubPlaybookService — minimal implementation of PlaybookService.
// Only Get is exercised by the permission helpers.
// ---------------------------------------------------------------------------

type stubPlaybookService struct {
	playbook Playbook
	err      error
}

func (s *stubPlaybookService) Get(id string) (Playbook, error) {
	return s.playbook, s.err
}

func (s *stubPlaybookService) Create(Playbook, string) (string, error) {
	panic("stubPlaybookService: Create not implemented")
}
func (s *stubPlaybookService) Import(PlaybookImportData, string) (string, error) {
	panic("stubPlaybookService: Import not implemented")
}
func (s *stubPlaybookService) GetPlaybooks() ([]Playbook, error) {
	panic("stubPlaybookService: GetPlaybooks not implemented")
}
func (s *stubPlaybookService) GetActivePlaybooks() ([]Playbook, error) {
	panic("stubPlaybookService: GetActivePlaybooks not implemented")
}
func (s *stubPlaybookService) GetPlaybooksForTeam(RequesterInfo, string, PlaybookFilterOptions) (GetPlaybooksResults, error) {
	panic("stubPlaybookService: GetPlaybooksForTeam not implemented")
}
func (s *stubPlaybookService) Update(Playbook, string) error {
	panic("stubPlaybookService: Update not implemented")
}
func (s *stubPlaybookService) Archive(Playbook, string) error {
	panic("stubPlaybookService: Archive not implemented")
}
func (s *stubPlaybookService) Restore(Playbook, string) error {
	panic("stubPlaybookService: Restore not implemented")
}
func (s *stubPlaybookService) AutoFollow(string, string) error {
	panic("stubPlaybookService: AutoFollow not implemented")
}
func (s *stubPlaybookService) AutoUnfollow(string, string) error {
	panic("stubPlaybookService: AutoUnfollow not implemented")
}
func (s *stubPlaybookService) GetAutoFollows(string) ([]string, error) {
	panic("stubPlaybookService: GetAutoFollows not implemented")
}
func (s *stubPlaybookService) Duplicate(Playbook, string) (string, error) {
	panic("stubPlaybookService: Duplicate not implemented")
}
func (s *stubPlaybookService) GetTopPlaybooksForTeam(string, string, *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("stubPlaybookService: GetTopPlaybooksForTeam not implemented")
}
func (s *stubPlaybookService) GetTopPlaybooksForUser(string, string, *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("stubPlaybookService: GetTopPlaybooksForUser not implemented")
}
func (s *stubPlaybookService) CreatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("stubPlaybookService: CreatePropertyField not implemented")
}
func (s *stubPlaybookService) UpdatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("stubPlaybookService: UpdatePropertyField not implemented")
}
func (s *stubPlaybookService) DeletePropertyField(string, string) error {
	panic("stubPlaybookService: DeletePropertyField not implemented")
}
func (s *stubPlaybookService) ReorderPropertyFields(string, string, int) ([]PropertyField, error) {
	panic("stubPlaybookService: ReorderPropertyFields not implemented")
}
func (s *stubPlaybookService) IncrementRunNumber(string) (int64, error) {
	panic("stubPlaybookService: IncrementRunNumber not implemented")
}
func (s *stubPlaybookService) GraphqlUpdate(string, map[string]interface{}) error {
	panic("stubPlaybookService: GraphqlUpdate not implemented")
}
func (s *stubPlaybookService) AddPlaybookMember(string, string) error {
	panic("stubPlaybookService: AddPlaybookMember not implemented")
}
func (s *stubPlaybookService) RemovePlaybookMember(string, string) error {
	panic("stubPlaybookService: RemovePlaybookMember not implemented")
}
func (s *stubPlaybookService) AddMetric(string, PlaybookMetricConfig) error {
	panic("stubPlaybookService: AddMetric not implemented")
}
func (s *stubPlaybookService) GetMetric(string) (*PlaybookMetricConfig, error) {
	panic("stubPlaybookService: GetMetric not implemented")
}
func (s *stubPlaybookService) UpdateMetric(string, map[string]interface{}) error {
	panic("stubPlaybookService: UpdateMetric not implemented")
}
func (s *stubPlaybookService) DeleteMetric(string) error {
	panic("stubPlaybookService: DeleteMetric not implemented")
}

func (s *stubPlaybookService) UpdateChannelNameTemplate(string, string, string) error {
	panic("stubPlaybookService: UpdateChannelNameTemplate not implemented")
}
func (s *stubPlaybookService) UpdateChannelNameTemplateIfUnchanged(string, string, string) (bool, error) {
	panic("stubPlaybookService: UpdateChannelNameTemplateIfUnchanged not implemented")
}
func (s *stubPlaybookService) UpdateRunNumberPrefix(string, string, string) error {
	panic("stubPlaybookService: UpdateRunNumberPrefix not implemented")
}
func (s *stubPlaybookService) UpdateChannelNameTemplateAtomically(string, func(string) string) error {
	panic("stubPlaybookService: UpdateChannelNameTemplateAtomically not implemented")
}
func (s *stubPlaybookService) GetPlaybookConditionsForExport(string) ([]Condition, error) {
	panic("stubPlaybookService: GetPlaybookConditionsForExport not implemented")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newPermissionsServiceForTest constructs a PermissionsService with the
// provided stubs. pluginAPI may be nil for tests that do not reach
// IsSystemAdmin or canViewTeam code paths; those tests will panic if the
// nil client is dereferenced, making the violation immediately visible.
func newPermissionsServiceForTest(
	runSvc PlaybookRunService,
	pbSvc PlaybookService,
	pluginAPI *pluginapi.Client,
) *PermissionsService {
	return &PermissionsService{
		runService:      runSvc,
		playbookService: pbSvc,
		pluginAPI:       pluginAPI,
	}
}

// newPluginAPIAllowingAdmins returns a *pluginapi.Client backed by a
// testify/mock plugin.API that:
//   - Returns true  for HasPermissionTo(uid, PermissionManageSystem) when uid
//     is in the adminIDs list.
//   - Returns false for any other uid.
//
// The mock uses Maybe() so callers do not need to know which exact IDs are
// queried; AssertExpectations is deferred to test cleanup.
func newPluginAPIAllowingAdmins(t *testing.T, adminIDs ...string) *pluginapi.Client {
	t.Helper()
	mockAPI := &plugintest.API{}

	// Allow team viewing for all users (needed by runManagePropertiesWithPlaybookRun).
	mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
		Return(true).
		Maybe()

	// Default: no user is a team admin unless explicitly added below.
	mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionManageTeam).
		Return(false).
		Maybe()

	// Register specific admin matches FIRST — testify matches in FIFO order,
	// so specific matchers must come before the general fallback.
	for _, id := range adminIDs {
		mockAPI.On("HasPermissionTo", id, model.PermissionManageSystem).
			Return(true).
			Maybe()
	}

	// Default: anyone not in adminIDs is not a system admin.
	mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
		Return(false).
		Maybe()

	t.Cleanup(func() { mockAPI.AssertExpectations(t) })
	return pluginapi.NewClient(mockAPI, nil)
}

// ---------------------------------------------------------------------------
// TestLoadRunAndPlaybook
// ---------------------------------------------------------------------------

func TestLoadRunAndPlaybook(t *testing.T) {
	const (
		runID      = "run-id-1"
		playbookID = "playbook-id-1"
	)

	t.Run("run not found returns nil run and error", func(t *testing.T) {
		notFoundErr := errors.New("run not found")
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nil, err: notFoundErr},
			&stubPlaybookService{},
			nil,
		)

		run, playbook, err := svc.loadRunAndPlaybook(runID)

		require.Error(t, err)
		assert.Nil(t, run, "run should be nil when not found")
		assert.Nil(t, playbook, "playbook should be nil when run not found")
	})

	t.Run("channel checklist run returns run with zero playbook and nil error", func(t *testing.T) {
		channelRun := &PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
			Type:       RunTypeChannelChecklist,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelRun, err: nil},
			// playbookService.Get must NOT be called for channel checklist runs
			&stubPlaybookService{},
			nil,
		)

		run, playbook, err := svc.loadRunAndPlaybook(runID)

		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, channelRun, run)
		assert.Nil(t, playbook, "playbook should be nil for channel checklist runs")
	})

	t.Run("standalone run with empty PlaybookID returns run with zero playbook and nil error", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID:         runID,
			PlaybookID: "", // empty — standalone run
			Type:       RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			// playbookService.Get must NOT be called for standalone runs
			&stubPlaybookService{},
			nil,
		)

		run, playbook, err := svc.loadRunAndPlaybook(runID)

		require.NoError(t, err)
		require.NotNil(t, run)
		assert.Equal(t, standaloneRun, run)
		assert.Nil(t, playbook, "playbook should be nil for standalone runs")
	})

	t.Run("run with valid playbook returns both", func(t *testing.T) {
		pb := Playbook{
			ID:    playbookID,
			Title: "My Playbook",
		}
		run := &PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
			Type:       RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: run, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			nil,
		)

		gotRun, gotPlaybook, err := svc.loadRunAndPlaybook(runID)

		require.NoError(t, err)
		require.NotNil(t, gotRun)
		assert.Equal(t, run, gotRun)
		assert.Equal(t, &pb, gotPlaybook)
	})

	t.Run("run exists but playbook deleted returns run with zero playbook and ErrNotFound", func(t *testing.T) {
		run := &PlaybookRun{
			ID:         runID,
			PlaybookID: playbookID,
			Type:       RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: run, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			nil,
		)

		gotRun, gotPlaybook, err := svc.loadRunAndPlaybook(runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNotFound), "expected errors.Is(err, ErrNotFound) to be true; got: %v", err)
		require.NotNil(t, gotRun, "run should not be nil when the playbook is deleted (run itself was found)")
		assert.Equal(t, run, gotRun)
		assert.Nil(t, gotPlaybook, "playbook should be nil when deleted")
	})
}

// ---------------------------------------------------------------------------
// TestRunFinish
// ---------------------------------------------------------------------------

func TestRunFinish(t *testing.T) {
	const (
		runID     = "run-finish-id"
		pbID      = "playbook-id-finish"
		ownerID   = "owner-user-id"
		memberID  = "member-non-owner-id"
		adminID   = "system-admin-user-id"
		pbAdminID = "playbook-admin-user-id"
	)

	makePlaybook := func(ownerOnly bool) Playbook {
		return Playbook{
			ID:                    pbID,
			TeamID:                "team-1",
			OwnerGroupOnlyActions: ownerOnly,
			Members: []PlaybookMember{
				{UserID: pbAdminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
				{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
				{UserID: ownerID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
	}

	baseRun := &PlaybookRun{
		ID:             runID,
		PlaybookID:     pbID,
		TeamID:         "team-1",
		OwnerUserID:    ownerID,
		ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
		Type:           RunTypePlaybook,
	}

	tests := []struct {
		name          string
		ownerOnly     bool
		userID        string
		isAdmin       bool
		shouldSucceed bool
	}{
		{"ownerOnly=false allows any participant", false, memberID, false, true},
		{"ownerOnly=true allows owner", true, ownerID, false, true},
		{"ownerOnly=true allows system admin", true, adminID, true, true},
		{"ownerOnly=true rejects playbook admin (non-owner)", true, pbAdminID, false, false},
		{"ownerOnly=true rejects non-owner member", true, memberID, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pb := makePlaybook(tt.ownerOnly)
			adminIDs := []string{}
			if tt.isAdmin {
				adminIDs = append(adminIDs, tt.userID)
			}
			svc := newPermissionsServiceForTest(
				&stubRunService{run: baseRun, err: nil},
				&stubPlaybookService{playbook: pb, err: nil},
				newPluginAPIAllowingAdmins(t, adminIDs...),
			)

			err := svc.RunFinish(tt.userID, runID)

			if tt.shouldSucceed {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
			}
		})
	}

	t.Run("channel checklist run has no restriction", func(t *testing.T) {
		channelChecklistRun := &PlaybookRun{
			ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
			ChannelID: "channel-1", Type: RunTypeChannelChecklist,
		}
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).Return(true).Maybe()
		mockAPI.On("GetChannel", "channel-1").Return(&model.Channel{Id: "channel-1"}, nil).Maybe()
		mockAPI.On("HasPermissionToChannel", memberID, "channel-1", model.PermissionCreatePost).Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelChecklistRun, err: nil},
			&stubPlaybookService{playbook: makePlaybook(true), err: nil},
			pluginapi.NewClient(mockAPI, nil),
		)
		require.NoError(t, svc.RunFinish(memberID, runID))
	})

	t.Run("standalone run has no restriction", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID: runID, PlaybookID: "", TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{ownerID, memberID}, Type: RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			&stubPlaybookService{},
			newPluginAPIAllowingAdmins(t),
		)
		require.NoError(t, svc.RunFinish(memberID, runID))
	})

	t.Run("deleted playbook allows owner and system admin, rejects non-owner", func(t *testing.T) {
		deletedPlaybookTests := []struct {
			name          string
			userID        string
			isAdmin       bool
			shouldSucceed bool
		}{
			{"owner can finish", ownerID, false, true},
			{"system admin can finish", adminID, true, true},
			{"non-owner member cannot finish", memberID, false, false},
		}
		for _, tt := range deletedPlaybookTests {
			t.Run(tt.name, func(t *testing.T) {
				adminIDs := []string{}
				if tt.isAdmin {
					adminIDs = append(adminIDs, tt.userID)
				}
				svc := newPermissionsServiceForTest(
					&stubRunService{run: baseRun, err: nil},
					&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
					newPluginAPIAllowingAdmins(t, adminIDs...),
				)
				err := svc.RunFinish(tt.userID, runID)
				if tt.shouldSucceed {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
					assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
				}
			})
		}
	})

	t.Run("run not found propagates error without nil pointer dereference", func(t *testing.T) {
		notFoundErr := errors.New("run not found in store")
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nil, err: notFoundErr},
			&stubPlaybookService{},
			nil, // must NOT panic — run is nil, so the error must propagate before dereferencing
		)

		// This must not panic even though run is nil
		err := svc.RunFinish(memberID, runID)

		require.Error(t, err)
		assert.False(t, errors.Is(err, ErrNoPermissions),
			"a missing-run error must propagate as-is, not be wrapped in ErrNoPermissions")
	})

}

// ---------------------------------------------------------------------------
// TestRunRestore
// ---------------------------------------------------------------------------

func TestRunRestore(t *testing.T) {
	const (
		runID     = "run-restore-id"
		pbID      = "playbook-id-restore"
		ownerID   = "owner-user-id"
		memberID  = "member-non-owner-id"
		adminID   = "system-admin-user-id"
		pbAdminID = "playbook-admin-user-id"
	)

	makePlaybook := func(ownerOnly bool) Playbook {
		return Playbook{
			ID:                    pbID,
			TeamID:                "team-1",
			OwnerGroupOnlyActions: ownerOnly,
			Members: []PlaybookMember{
				{UserID: pbAdminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
				{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
				{UserID: ownerID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
	}

	baseRun := &PlaybookRun{
		ID:             runID,
		PlaybookID:     pbID,
		TeamID:         "team-1",
		OwnerUserID:    ownerID,
		ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
		Type:           RunTypePlaybook,
	}

	tests := []struct {
		name          string
		ownerOnly     bool
		userID        string
		isAdmin       bool
		shouldSucceed bool
	}{
		{"ownerOnly=false allows any participant", false, memberID, false, true},
		{"ownerOnly=true allows owner", true, ownerID, false, true},
		{"ownerOnly=true allows system admin", true, adminID, true, true},
		{"ownerOnly=true rejects playbook admin (non-owner)", true, pbAdminID, false, false},
		{"ownerOnly=true rejects non-owner member", true, memberID, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pb := makePlaybook(tt.ownerOnly)
			adminIDs := []string{}
			if tt.isAdmin {
				adminIDs = append(adminIDs, tt.userID)
			}
			svc := newPermissionsServiceForTest(
				&stubRunService{run: baseRun, err: nil},
				&stubPlaybookService{playbook: pb, err: nil},
				newPluginAPIAllowingAdmins(t, adminIDs...),
			)

			err := svc.RunRestore(tt.userID, runID)

			if tt.shouldSucceed {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
			}
		})
	}

	t.Run("channel checklist run has no restriction", func(t *testing.T) {
		channelChecklistRun := &PlaybookRun{
			ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
			ChannelID: "channel-1", Type: RunTypeChannelChecklist,
		}
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).Return(true).Maybe()
		mockAPI.On("GetChannel", "channel-1").Return(&model.Channel{Id: "channel-1"}, nil).Maybe()
		mockAPI.On("HasPermissionToChannel", memberID, "channel-1", model.PermissionCreatePost).Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelChecklistRun, err: nil},
			&stubPlaybookService{playbook: makePlaybook(true), err: nil},
			pluginapi.NewClient(mockAPI, nil),
		)
		require.NoError(t, svc.RunRestore(memberID, runID))
	})

	t.Run("standalone run has no restriction", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID: runID, PlaybookID: "", TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{ownerID, memberID}, Type: RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			&stubPlaybookService{},
			newPluginAPIAllowingAdmins(t),
		)
		require.NoError(t, svc.RunRestore(memberID, runID))
	})

	t.Run("deleted playbook — owner and system admin can restore, non-owner cannot", func(t *testing.T) {
		deletedPlaybookTests := []struct {
			name          string
			userID        string
			isAdmin       bool
			shouldSucceed bool
		}{
			{"owner can restore", ownerID, false, true},
			{"system admin can restore", adminID, true, true},
			{"non-owner member cannot restore", memberID, false, false},
		}
		for _, tt := range deletedPlaybookTests {
			t.Run(tt.name, func(t *testing.T) {
				adminIDs := []string{}
				if tt.isAdmin {
					adminIDs = append(adminIDs, tt.userID)
				}
				svc := newPermissionsServiceForTest(
					&stubRunService{run: baseRun, err: nil},
					&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
					newPluginAPIAllowingAdmins(t, adminIDs...),
				)
				err := svc.RunRestore(tt.userID, runID)
				if tt.shouldSucceed {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
					assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
				}
			})
		}
	})

	t.Run("run not found propagates error without panic", func(t *testing.T) {
		notFoundErr := errors.New("run not found in store")
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nil, err: notFoundErr},
			&stubPlaybookService{},
			nil,
		)
		err := svc.RunRestore(memberID, runID)
		require.Error(t, err)
		assert.False(t, errors.Is(err, ErrNoPermissions))
	})
}

// ---------------------------------------------------------------------------
// TestRunChangeOwner
// ---------------------------------------------------------------------------

func TestRunChangeOwner(t *testing.T) {
	const (
		runID     = "run-changeowner-id"
		pbID      = "playbook-id-changeowner"
		ownerID   = "owner-user-id"
		memberID  = "member-non-owner-id"
		adminID   = "system-admin-user-id"
		pbAdminID = "playbook-admin-user-id"
	)

	makePlaybook := func(ownerOnly bool) Playbook {
		return Playbook{
			ID:                    pbID,
			TeamID:                "team-1",
			OwnerGroupOnlyActions: ownerOnly,
			Members: []PlaybookMember{
				{UserID: pbAdminID, SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
				{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
				{UserID: ownerID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
	}

	baseRun := &PlaybookRun{
		ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
		ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID}, Type: RunTypePlaybook,
	}

	tests := []struct {
		name          string
		ownerOnly     bool
		userID        string
		isAdmin       bool
		shouldSucceed bool
	}{
		{"ownerOnly=false allows any participant", false, memberID, false, true},
		{"ownerOnly=true allows owner", true, ownerID, false, true},
		{"ownerOnly=true allows system admin", true, adminID, true, true},
		{"ownerOnly=true allows playbook admin", true, pbAdminID, false, true},
		{"ownerOnly=true rejects non-owner member", true, memberID, false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pb := makePlaybook(tt.ownerOnly)
			adminIDs := []string{}
			if tt.isAdmin {
				adminIDs = append(adminIDs, tt.userID)
			}
			svc := newPermissionsServiceForTest(
				&stubRunService{run: baseRun, err: nil},
				&stubPlaybookService{playbook: pb, err: nil},
				newPluginAPIAllowingAdmins(t, adminIDs...),
			)
			err := svc.RunChangeOwner(tt.userID, runID)
			if tt.shouldSucceed {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
			}
		})
	}

	t.Run("ownerOnly=false blocks non-participant playbook admin", func(t *testing.T) {
		// pbAdminID is a playbook admin (in Members) but NOT a run participant.
		// When OwnerGroupOnlyActions is false, the bypass must NOT fire — the
		// standard participant gate should still deny them.
		nonParticipantRun := &PlaybookRun{
			ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{ownerID, memberID}, Type: RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nonParticipantRun, err: nil},
			&stubPlaybookService{playbook: makePlaybook(false), err: nil},
			newPluginAPIAllowingAdmins(t),
		)
		err := svc.RunChangeOwner(pbAdminID, runID)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
	})

	t.Run("ownerOnly=true allows non-participant playbook admin", func(t *testing.T) {
		// pbAdminID is a playbook admin (in Members) but NOT a run participant.
		// OwnerGroupOnlyActions still permits playbook-admin ownership handoff so
		// the original owner can be replaced when unavailable.
		nonParticipantRun := &PlaybookRun{
			ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{ownerID, memberID}, Type: RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nonParticipantRun, err: nil},
			&stubPlaybookService{playbook: makePlaybook(true), err: nil},
			newPluginAPIAllowingAdmins(t),
		)
		err := svc.RunChangeOwner(pbAdminID, runID)
		require.NoError(t, err)
	})

	t.Run("channel checklist run has no restriction", func(t *testing.T) {
		channelChecklistRun := &PlaybookRun{
			ID: runID, PlaybookID: pbID, TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{memberID}, ChannelID: "ch-1", Type: RunTypeChannelChecklist,
		}
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).Return(true).Maybe()
		mockAPI.On("GetChannel", "ch-1").Return(&model.Channel{Id: "ch-1"}, nil).Maybe()
		mockAPI.On("HasPermissionToChannel", memberID, "ch-1", model.PermissionCreatePost).Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelChecklistRun, err: nil},
			&stubPlaybookService{playbook: makePlaybook(true), err: nil},
			pluginapi.NewClient(mockAPI, nil),
		)
		require.NoError(t, svc.RunChangeOwner(memberID, runID))
	})

	t.Run("standalone run has no restriction", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID: runID, PlaybookID: "", TeamID: "team-1", OwnerUserID: ownerID,
			ParticipantIDs: []string{memberID}, Type: RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			&stubPlaybookService{},
			newPluginAPIAllowingAdmins(t),
		)
		require.NoError(t, svc.RunChangeOwner(memberID, runID))
	})

	t.Run("deleted playbook — owner can reassign, non-owner cannot", func(t *testing.T) {
		deletedPlaybookTests := []struct {
			name          string
			userID        string
			shouldSucceed bool
		}{
			{"owner can reassign", ownerID, true},
			{"non-owner cannot", memberID, false},
		}
		for _, tt := range deletedPlaybookTests {
			t.Run(tt.name, func(t *testing.T) {
				svc := newPermissionsServiceForTest(
					&stubRunService{run: baseRun, err: nil},
					&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
					newPluginAPIAllowingAdmins(t),
				)
				err := svc.RunChangeOwner(tt.userID, runID)
				if tt.shouldSucceed {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
					assert.True(t, errors.Is(err, ErrNoPermissions), "got: %v", err)
				}
			})
		}
	})

	t.Run("run not found propagates error without panic", func(t *testing.T) {
		notFoundErr := errors.New("run not found in store")
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nil, err: notFoundErr},
			&stubPlaybookService{},
			nil,
		)
		err := svc.RunChangeOwner(memberID, runID)
		require.Error(t, err)
		assert.False(t, errors.Is(err, ErrNoPermissions))
	})
}

// TestIsPlaybookAdmin tests the (*PermissionsService).IsPlaybookAdmin method
// that supports the OwnerGroupOnlyActions permission check and the playbook-admin
// owner reassignment bypass.
//
// It returns true only when the user has team-view access AND the user's
// SchemeRoles contains PlaybookRoleAdmin (or DefaultPlaybookAdminRole).
func TestIsPlaybookAdmin(t *testing.T) {
	adminID := "user-admin"
	memberID := "user-member"
	outsiderID := "user-outsider"
	teamID := "team-1"

	playbook := Playbook{
		ID:     "pb-1",
		TeamID: teamID,
		Members: []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
		},
	}

	t.Run("admin member returns true", func(t *testing.T) {
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.True(t, svc.IsPlaybookAdmin(adminID, playbook))
	})

	t.Run("regular member returns false", func(t *testing.T) {
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.False(t, svc.IsPlaybookAdmin(memberID, playbook))
	})

	t.Run("non-member returns false", func(t *testing.T) {
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.False(t, svc.IsPlaybookAdmin(outsiderID, playbook))
	})

	t.Run("empty members list returns false", func(t *testing.T) {
		pb := Playbook{ID: "pb-2", TeamID: teamID, Members: []PlaybookMember{}}
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.False(t, svc.IsPlaybookAdmin(adminID, pb))
	})

	t.Run("user with both member and admin scheme roles returns true", func(t *testing.T) {
		pb := Playbook{
			ID:     "pb-3",
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
			},
		}
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.True(t, svc.IsPlaybookAdmin(adminID, pb))
	})

	t.Run("user with nil scheme roles returns false", func(t *testing.T) {
		pb := Playbook{
			ID:     "pb-4",
			TeamID: teamID,
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: nil},
			},
		}
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIAllowingAdmins(t))
		require.False(t, svc.IsPlaybookAdmin(adminID, pb))
	})

	t.Run("admin without team-view returns false", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", adminID, teamID, model.PermissionViewTeam).
			Return(false).
			Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))
		require.False(t, svc.IsPlaybookAdmin(adminID, playbook))
	})
}

// permFakeRunService is a partial mock of PlaybookRunService for permission tests.
// Only GetPlaybookRun is overridden; all other methods panic if called.
type permFakeRunService struct {
	PlaybookRunService
	runs map[string]*PlaybookRun
}

func (f *permFakeRunService) GetPlaybookRun(id string) (*PlaybookRun, error) {
	run, ok := f.runs[id]
	if !ok {
		return nil, fmt.Errorf("run %s not found", id)
	}
	return run, nil
}

func newPermSvc(api *plugintest.API, run *PlaybookRun) *PermissionsService {
	return &PermissionsService{
		pluginAPI:  pluginapi.NewClient(api, &plugintest.Driver{}),
		runService: &permFakeRunService{runs: map[string]*PlaybookRun{run.ID: run}},
	}
}

func TestRunViewDMGM(t *testing.T) {
	t.Run("DM run allows user with channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("DM run denies user without channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunView(userID, run.ID), ErrNoPermissions)
	})

	t.Run("GM run allows user with channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID, Type: RunTypeChannelChecklist}

		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("team-channel checklist uses channel read permission, not playbook access", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID, // non-empty: team-based channel checklist
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunView(userID, run.ID))
	})

	t.Run("team-channel checklist denies user without channel read permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionReadChannel).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunView(userID, run.ID), ErrNoPermissions)
	})
}

func TestRunManagePropertiesDMGM(t *testing.T) {
	t.Run("DM run allows user with channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunManageProperties(userID, run.ID))
	})

	t.Run("DM run denies user without channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})

	t.Run("DM run in archived channel denies all users", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{ID: model.NewId(), TeamID: "", ChannelID: channelID}

		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: model.GetMillis(),
		}, (*model.AppError)(nil))

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})

	t.Run("team-channel checklist allows user with channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunManageProperties(userID, run.ID))
	})

	t.Run("team-channel checklist denies user without channel post permission", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		userID := model.NewId()
		teamID := model.NewId()
		channelID := model.NewId()
		run := &PlaybookRun{
			ID:        model.NewId(),
			TeamID:    teamID,
			ChannelID: channelID,
			Type:      RunTypeChannelChecklist,
		}

		api.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).Return(true)
		api.On("GetChannel", channelID).Return(&model.Channel{
			Id:       channelID,
			DeleteAt: 0,
		}, (*model.AppError)(nil))
		api.On("HasPermissionToChannel", userID, channelID, model.PermissionCreatePost).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunManageProperties(userID, run.ID), ErrNoPermissions)
	})
}

func TestRunToggleRetrospective(t *testing.T) {
	ownerID := model.NewId()
	channelID := model.NewId()
	run := &PlaybookRun{
		ID:          model.NewId(),
		ChannelID:   channelID,
		OwnerUserID: ownerID,
	}

	t.Run("system admin can toggle any run", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		adminID := model.NewId()
		api.On("HasPermissionTo", adminID, model.PermissionManageSystem).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunToggleRetrospective(adminID, run.ID))
	})

	t.Run("run owner with channel access can toggle", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		api.On("HasPermissionTo", ownerID, model.PermissionManageSystem).Return(false)
		api.On("HasPermissionToChannel", ownerID, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.NoError(t, svc.RunToggleRetrospective(ownerID, run.ID))
	})

	t.Run("channel member who is not owner is forbidden", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		nonOwner := model.NewId()
		api.On("HasPermissionTo", nonOwner, model.PermissionManageSystem).Return(false)
		api.On("HasPermissionToChannel", nonOwner, channelID, model.PermissionReadChannel).Return(true)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunToggleRetrospective(nonOwner, run.ID), ErrNoPermissions)
	})

	t.Run("user without channel access is forbidden", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		outsider := model.NewId()
		api.On("HasPermissionTo", outsider, model.PermissionManageSystem).Return(false)
		api.On("HasPermissionToChannel", outsider, channelID, model.PermissionReadChannel).Return(false)

		svc := newPermSvc(api, run)
		require.ErrorIs(t, svc.RunToggleRetrospective(outsider, run.ID), ErrNoPermissions)
	})
}
