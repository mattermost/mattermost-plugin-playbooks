// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

// permFakeRunService is a partial mock of PlaybookRunService for permission tests.
// Only GetPlaybookRun is overridden; all other methods panic if called.
type permFakeRunService struct {
	PlaybookRunService
	runs map[string]*PlaybookRun
}

func (f *permFakeRunService) GetPlaybookRun(id string) (*PlaybookRun, error) {
	run, ok := f.runs[id]
	if !ok {
		return nil, errors.Errorf("run %s not found", id)
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

// permissionsTestFixture wires up a PermissionsService with a configurable
// plugintest.API so tests can assert PlaybookCreateWithMembers behavior.
type permissionsTestFixture struct {
	api       *plugintest.API
	svc       *PermissionsService
	playbooks *stubPlaybookService
}

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
	playbooks := &stubPlaybookService{}
	svc := &PermissionsService{
		playbookService: playbooks,
		pluginAPI:       pluginapi.NewClient(api, nil),
		licenseChecker:  allowAllLicenseChecker{},
	}
	t.Cleanup(func() { api.AssertExpectations(t) })
	return &permissionsTestFixture{api: api, svc: svc, playbooks: playbooks}
}

func TestPlaybookCreateWithMembers(t *testing.T) {
	const (
		teamID    = "team-1"
		creatorID = "u-creator"
		targetID  = "u-target"
	)

	makePlaybook := func(members []PlaybookMember) Playbook {
		return Playbook{
			TeamID:  teamID,
			Public:  false,
			Members: members,
		}
	}

	allowCreatorTeamView := func(f *permissionsTestFixture) {
		f.api.On("HasPermissionToTeam", creatorID, teamID, model.PermissionViewTeam).Return(true).Maybe()
		f.api.On("HasPermissionToTeam", creatorID, teamID, mock.Anything).Return(false).Maybe()
	}

	t.Run("empty members list is always allowed (creator auto-assigned later)", func(t *testing.T) {
		f := newPermissionsFixture(t)
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, makePlaybook(nil)))
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, makePlaybook([]PlaybookMember{})))
	})

	t.Run("creator self-assigning as sole admin is always allowed (mirrors default assignment)", func(t *testing.T) {
		f := newPermissionsFixture(t)
		pb := makePlaybook([]PlaybookMember{
			{UserID: creatorID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pb))

		pbReversed := makePlaybook([]PlaybookMember{
			{UserID: creatorID, Roles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pbReversed))
	})

	t.Run("creator self-assigning as plain member only is always allowed", func(t *testing.T) {
		f := newPermissionsFixture(t)
		pb := makePlaybook([]PlaybookMember{
			{UserID: creatorID, Roles: []string{PlaybookRoleMember}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pb))
	})

	t.Run("creator can pre-assign members their playbook admin role would let them add anyway", func(t *testing.T) {
		f := newPermissionsFixture(t)
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", []string{PlaybookRoleAdmin, PlaybookRoleMember}, model.PermissionPrivatePlaybookManageMembers.Id).Return(true)
		f.api.On("RolesGrantPermission", []string{PlaybookRoleAdmin, PlaybookRoleMember}, model.PermissionPrivatePlaybookManageRoles.Id).Return(true)

		pb := makePlaybook([]PlaybookMember{
			{UserID: creatorID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
			{UserID: targetID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pb))
	})

	t.Run("playbook admin role stripped of ManageMembers blocks adding another user", func(t *testing.T) {
		f := newPermissionsFixture(t)
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(false)

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember}},
		})
		assert.ErrorIs(t, f.svc.PlaybookCreateWithMembers(creatorID, pb), ErrNoPermissions)
	})

	t.Run("playbook admin role without ManageRoles cannot pre-assign another admin", func(t *testing.T) {
		f := newPermissionsFixture(t)
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), model.PermissionPrivatePlaybookManageMembers.Id).Return(true)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), model.PermissionPrivatePlaybookManageRoles.Id).Return(false)

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
		})
		assert.ErrorIs(t, f.svc.PlaybookCreateWithMembers(creatorID, pb), ErrNoPermissions)
	})

	t.Run("adding a plain member needs ManageMembers but not ManageRoles", func(t *testing.T) {
		f := newPermissionsFixture(t)
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), model.PermissionPrivatePlaybookManageMembers.Id).Return(true)

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pb))
	})

	t.Run("team-level ManageMembers still authorizes creation with members", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(false)
		f.api.On("HasPermissionToTeam", creatorID, teamID, model.PermissionViewTeam).Return(true).Maybe()
		f.api.On("HasPermissionToTeam", creatorID, teamID, model.PermissionPrivatePlaybookManageMembers).Return(true)

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember}},
		})
		assert.NoError(t, f.svc.PlaybookCreateWithMembers(creatorID, pb))
	})

	t.Run("the creator's role is resolved from the team scheme, not the built-in role", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.playbooks.schemeRoles = PlaybookSchemeRoles{AdminRole: "custom_pb_admin", MemberRole: "custom_pb_member"}
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", []string{"custom_pb_admin", "custom_pb_member"}, model.PermissionPrivatePlaybookManageMembers.Id).Return(false)

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember}},
		})
		assert.ErrorIs(t, f.svc.PlaybookCreateWithMembers(creatorID, pb), ErrNoPermissions)
	})

	t.Run("client-supplied roles cannot authorize the request", func(t *testing.T) {
		f := newPermissionsFixture(t)
		allowCreatorTeamView(f)
		f.api.On("RolesGrantPermission", []string{PlaybookRoleAdmin, PlaybookRoleMember}, model.PermissionPublicPlaybookManageMembers.Id).Return(false)

		pb := Playbook{
			TeamID:                    teamID,
			Public:                    true,
			DefaultPlaybookAdminRole:  "attacker_supplied_admin_role",
			DefaultPlaybookMemberRole: "attacker_supplied_member_role",
			Members: []PlaybookMember{
				{UserID: creatorID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}, SchemeRoles: []string{"attacker_supplied_admin_role"}},
				{UserID: targetID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
			},
		}
		assert.ErrorIs(t, f.svc.PlaybookCreateWithMembers(creatorID, pb), ErrNoPermissions)
	})

	t.Run("a failure resolving the scheme roles denies the request", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.playbooks.schemeErr = errors.New("db is down")

		pb := makePlaybook([]PlaybookMember{
			{UserID: targetID, Roles: []string{PlaybookRoleMember}},
		})
		err := f.svc.PlaybookCreateWithMembers(creatorID, pb)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "db is down")
	})
}

func TestNoAddedMembersWithoutPermission(t *testing.T) {
	const (
		teamID   = "team-1"
		editorID = "u-editor"
	)

	makePlaybook := func(members []PlaybookMember) Playbook {
		return Playbook{
			TeamID:  teamID,
			Public:  false,
			Members: members,
		}
	}

	t.Run("nil and empty member lists are treated as equivalent", func(t *testing.T) {
		f := newPermissionsFixture(t)
		assert.NoError(t, f.svc.noAddedMembersWithoutPermission(editorID, makePlaybook(nil), nil, nil))
		assert.NoError(t, f.svc.noAddedMembersWithoutPermission(editorID, makePlaybook(nil), nil, []PlaybookMember{}))
		assert.NoError(t, f.svc.noAddedMembersWithoutPermission(editorID, makePlaybook(nil), []PlaybookMember{}, nil))
	})

	t.Run("reordered roles do not require ManageRoles", func(t *testing.T) {
		f := newPermissionsFixture(t)
		f.api.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(false).Maybe()
		f.api.On("HasPermissionToTeam", editorID, teamID, model.PermissionViewTeam).Return(true).Maybe()
		f.api.On("HasPermissionToTeam", editorID, teamID, model.PermissionPrivatePlaybookManageMembers).Return(true)

		oldMembers := []PlaybookMember{
			{UserID: editorID, Roles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
		}
		newMembers := []PlaybookMember{
			{UserID: editorID, Roles: []string{PlaybookRoleAdmin, PlaybookRoleMember}},
		}

		assert.NoError(t, f.svc.noAddedMembersWithoutPermission(editorID, makePlaybook(oldMembers), oldMembers, newMembers))
	})
}

// stubPlaybookService is a PlaybookService stub for permission tests on this release branch.
type stubPlaybookService struct {
	playbook    Playbook
	err         error
	schemeRoles PlaybookSchemeRoles
	schemeErr   error
}

func (s *stubPlaybookService) Get(id string) (Playbook, error) {
	if s.err != nil {
		return Playbook{}, s.err
	}
	return s.playbook, nil
}
func (s *stubPlaybookService) GetTeamPlaybookSchemeRoles(string) (PlaybookSchemeRoles, error) {
	if s.schemeErr != nil {
		return PlaybookSchemeRoles{}, s.schemeErr
	}
	if s.schemeRoles.AdminRole == "" && s.schemeRoles.MemberRole == "" {
		return PlaybookSchemeRoles{AdminRole: PlaybookRoleAdmin, MemberRole: PlaybookRoleMember}, nil
	}
	return s.schemeRoles, nil
}
func (s *stubPlaybookService) Create(Playbook, string) (string, error) {
	panic("stubPlaybookService: Create not implemented")
}
func (s *stubPlaybookService) Import(PlaybookImportData, string) (string, error) {
	panic("stubPlaybookService: Import not implemented")
}
func (s *stubPlaybookService) GetPlaybookConditionsForExport(string) ([]Condition, error) {
	panic("stubPlaybookService: GetPlaybookConditionsForExport not implemented")
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
