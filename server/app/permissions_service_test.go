// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// permissionsTestFixture wires up a PermissionsService with a configurable
// plugintest.API so tests can assert behavior of PlaybookEdit, IsPlaybookAdmin,
// and canChangeAdminOnlyEdit without standing up the full app stack.
type permissionsTestFixture struct {
	api *plugintest.API
	svc *PermissionsService
}

func newPermissionsFixture(t *testing.T) *permissionsTestFixture {
	t.Helper()
	api := &plugintest.API{}
	svc := &PermissionsService{
		pluginAPI: pluginapi.NewClient(api, nil),
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

func TestIsPlaybookAdmin(t *testing.T) {
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

func TestCanChangeAdminOnlyEdit(t *testing.T) {
	const (
		teamID     = "team-1"
		playbookID = "pb-1"
		sysadminID = "u-sysadmin"
		adminID    = "u-pb-admin"
		memberID   = "u-pb-member"
	)

	t.Run("system admin allowed", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.allowSysadmin(sysadminID)

		pb := Playbook{ID: playbookID, TeamID: teamID, AdminOnlyEdit: true}
		assert.NoError(t, f.svc.canChangeAdminOnlyEdit(sysadminID, pb))
	})

	t.Run("playbook admin allowed (symmetric — independent of current flag value)", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.allowTeamView(adminID, teamID)

		pb := Playbook{
			ID:     playbookID,
			TeamID: teamID,
			Public: true,
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}

		// Flag currently OFF → admin can enable.
		pb.AdminOnlyEdit = false
		assert.NoError(t, f.svc.canChangeAdminOnlyEdit(adminID, pb))

		// Flag currently ON → admin can disable. Same gate, same actor.
		pb.AdminOnlyEdit = true
		assert.NoError(t, f.svc.canChangeAdminOnlyEdit(adminID, pb))
	})

	t.Run("admin-role member who has lost team access is denied", func(t *testing.T) {
		// Compliance-style scenario: a user was a playbook admin, then was removed
		// from the team. Their Members entry still carries the admin role, but the
		// flip gate must fail-closed because team access is gone.
		f := newPermissionsFixture(t)
		f.denySysadmin(adminID)
		f.denyTeamView(adminID, teamID)

		pb := Playbook{
			ID:     playbookID,
			TeamID: teamID,
			Public: true,
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}

		err := f.svc.canChangeAdminOnlyEdit(adminID, pb)
		assert.ErrorIs(t, err, ErrNoPermissions)
	})

	t.Run("plain member denied even with PlaybookManageProperties cascade", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.denySysadmin(memberID)
		f.allowTeamView(memberID, teamID)

		pb := Playbook{
			ID:     playbookID,
			TeamID: teamID,
			Public: true,
			Members: []PlaybookMember{
				{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}

		err := f.svc.canChangeAdminOnlyEdit(memberID, pb)
		assert.ErrorIs(t, err, ErrNoPermissions)
		assert.Contains(t, err.Error(), "admin_only_edit")
	})
}
