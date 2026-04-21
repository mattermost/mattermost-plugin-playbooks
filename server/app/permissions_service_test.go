// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

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
func (s *stubRunService) CreatePlaybookRun(*PlaybookRun, *Playbook, string, bool, string, string, map[string]json.RawMessage) (*PlaybookRun, error) {
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
func (s *stubRunService) ResolveRunCreationParams(*PlaybookRun, *Playbook, map[string]json.RawMessage, string) (string, error) {
	panic("stubRunService: ResolveRunCreationParams not implemented")
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

// newPluginAPIGrantingTeamAccess returns a *pluginapi.Client whose underlying
// plugin.API grants PermissionViewTeam and PermissionListTeamChannels to the
// given user on the given team. Used for getPlaybookRole tests where the
// method needs canViewTeam and HasPermissionToTeam to return true.
func newPluginAPIGrantingTeamAccess(t *testing.T, userID, teamID string) *pluginapi.Client {
	t.Helper()
	mockAPI := &plugintest.API{}

	mockAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).
		Return(true).Maybe()
	mockAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionListTeamChannels).
		Return(true).Maybe()

	t.Cleanup(func() { mockAPI.AssertExpectations(t) })
	return pluginapi.NewClient(mockAPI, nil)
}

// TestIsPlaybookAdmin was removed: the isPlaybookAdmin method was replaced
// with PlaybookManageProperties, which uses scheme-aware permission checks
// instead of direct role string comparisons.

// ---------------------------------------------------------------------------
// TestGetPlaybookRole_DefaultRoleFallback
//
// Verifies the bug fix: the condition in getPlaybookRole was inverted.
//
// Before fix (buggy):
//   if playbook.DefaultPlaybookMemberRole == "" {
//       return []string{playbook.DefaultPlaybookMemberRole}  // returns [""]
//   }
//   return []string{PlaybookRoleMember}
//
// After fix:
//   if playbook.DefaultPlaybookMemberRole != "" {
//       return []string{playbook.DefaultPlaybookMemberRole}  // returns custom role
//   }
//   return []string{PlaybookRoleMember}  // fallback
//
// These tests use in-memory Playbook{} structs (DefaultPlaybookMemberRole == "")
// which hit the dead-branch in the pre-fix code. In production, COALESCE in
// the SQL query ensures a non-empty value — but unit tests bypass the store,
// making the bug observable here.
// ---------------------------------------------------------------------------

func TestGetPlaybookRole_DefaultRoleFallback(t *testing.T) {
	const (
		userID = "user-123"
		teamID = "team-abc"
	)

	t.Run("empty DefaultPlaybookMemberRole returns PlaybookRoleMember not empty string", func(t *testing.T) {
		// After the fix, DefaultPlaybookMemberRole == "" should fall through to
		// return []string{PlaybookRoleMember}, NOT []string{""}.
		playbook := Playbook{
			ID:                        "pb-id",
			TeamID:                    teamID,
			Public:                    true,
			Members:                   []PlaybookMember{}, // userID is NOT an explicit member
			DefaultPlaybookMemberRole: "",                 // empty — triggers the fallback path
		}

		pluginAPI := newPluginAPIGrantingTeamAccess(t, userID, teamID)
		svc := newPermissionsServiceForTest(nil, nil, pluginAPI)

		roles := svc.getPlaybookRole(userID, playbook)

		require.Len(t, roles, 1, "expected exactly one role")
		assert.Equal(t, PlaybookRoleMember, roles[0],
			"empty DefaultPlaybookMemberRole must fall back to %q, not empty string", PlaybookRoleMember)
	})

	t.Run("non-empty DefaultPlaybookMemberRole returns that role", func(t *testing.T) {
		const customRole = "playbook_custom_scheme_role"
		playbook := Playbook{
			ID:                        "pb-id",
			TeamID:                    teamID,
			Public:                    true,
			Members:                   []PlaybookMember{},
			DefaultPlaybookMemberRole: customRole,
		}

		pluginAPI := newPluginAPIGrantingTeamAccess(t, userID, teamID)
		svc := newPermissionsServiceForTest(nil, nil, pluginAPI)

		roles := svc.getPlaybookRole(userID, playbook)

		require.Len(t, roles, 1)
		assert.Equal(t, customRole, roles[0],
			"non-empty DefaultPlaybookMemberRole must be returned verbatim")
	})

	t.Run("explicit member of public playbook gets their member SchemeRoles, not the default", func(t *testing.T) {
		// Even for a public playbook, a user who is listed in Members must get
		// their explicit SchemeRoles back, not the DefaultPlaybookMemberRole fallback.
		const customRole = "playbook_custom_scheme_role"
		playbook := Playbook{
			ID:     "pb-id",
			TeamID: teamID,
			Public: true,
			Members: []PlaybookMember{
				{
					UserID:      userID,
					SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember},
				},
			},
			DefaultPlaybookMemberRole: customRole,
		}

		pluginAPI := newPluginAPIGrantingTeamAccess(t, userID, teamID)
		svc := newPermissionsServiceForTest(nil, nil, pluginAPI)

		roles := svc.getPlaybookRole(userID, playbook)

		require.Len(t, roles, 2, "explicit member must get their own SchemeRoles, not the default role")
		assert.Equal(t, []string{PlaybookRoleAdmin, PlaybookRoleMember}, roles,
			"explicit member SchemeRoles must be returned unchanged")
	})

	t.Run("private playbook: team member not in Members list gets no role", func(t *testing.T) {
		// A private playbook (Public=false) must never grant a role to users
		// who are not listed in Members, even if they are team members.
		playbook := Playbook{
			ID:                        "pb-id",
			TeamID:                    teamID,
			Public:                    false,
			Members:                   []PlaybookMember{}, // userID is NOT a member
			DefaultPlaybookMemberRole: PlaybookRoleMember,
		}

		// pluginAPI only needs to answer PermissionViewTeam (for canViewTeam).
		// PermissionListTeamChannels must NOT be called because the public
		// branch is never reached.
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", userID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		pluginAPI := pluginapi.NewClient(mockAPI, nil)

		svc := newPermissionsServiceForTest(nil, nil, pluginAPI)

		roles := svc.getPlaybookRole(userID, playbook)

		require.Empty(t, roles,
			"private playbook must return no role for a team member not listed in Members")
	})
}

// ---------------------------------------------------------------------------
// TestPlaybookMakePublic
// ---------------------------------------------------------------------------

func TestPlaybookMakePublic(t *testing.T) {
	const (
		teamID    = "team-makepublic-1"
		memberID  = "member-user-id"
		nonMember = "non-member-user-id"
	)

	privatePlaybook := Playbook{
		ID:     "pb-private-1",
		TeamID: teamID,
		Public: false,
		Members: []PlaybookMember{
			{
				UserID:      memberID,
				Roles:       []string{PlaybookRoleMember},
				SchemeRoles: []string{PlaybookRoleMember},
			},
		},
	}

	t.Run("member with team-level PrivatePlaybookMakePublic permission is allowed", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionListTeamChannels).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionPrivatePlaybookMakePublic).
			Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePublic(memberID, privatePlaybook)
		require.NoError(t, err)
	})

	t.Run("member without team-level PrivatePlaybookMakePublic permission is denied", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionListTeamChannels).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionPrivatePlaybookMakePublic).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePublic(memberID, privatePlaybook)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions))
	})

	t.Run("non-member without team-level permission is denied", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", nonMember, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", nonMember, teamID, model.PermissionPrivatePlaybookMakePublic).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePublic(nonMember, privatePlaybook)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions))
	})

	t.Run("non-member with team-level permission is allowed", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", nonMember, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", nonMember, teamID, model.PermissionPrivatePlaybookMakePublic).
			Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePublic(nonMember, privatePlaybook)
		require.NoError(t, err)
	})
}

// ---------------------------------------------------------------------------
// TestPlaybookMakePrivate
// ---------------------------------------------------------------------------

func TestPlaybookMakePrivate(t *testing.T) {
	const (
		teamID    = "team-makeprivate-1"
		memberID  = "member-user-id"
		nonMember = "non-member-user-id"
	)

	publicPlaybook := Playbook{
		ID:     "pb-public-1",
		TeamID: teamID,
		Public: true,
		Members: []PlaybookMember{
			{
				UserID:      memberID,
				Roles:       []string{PlaybookRoleMember},
				SchemeRoles: []string{PlaybookRoleMember},
			},
		},
	}

	t.Run("member with team-level PublicPlaybookMakePrivate permission is allowed", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionListTeamChannels).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionPublicPlaybookMakePrivate).
			Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePrivate(memberID, publicPlaybook)
		require.NoError(t, err)
	})

	t.Run("member without team-level PublicPlaybookMakePrivate permission is denied", func(t *testing.T) {
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionListTeamChannels).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionPublicPlaybookMakePrivate).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })

		svc := newPermissionsServiceForTest(nil, nil, pluginapi.NewClient(mockAPI, nil))

		err := svc.PlaybookMakePrivate(memberID, publicPlaybook)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions))
	})
}

// ---------------------------------------------------------------------------
// TestPlaybookModifyWithFixes_VisibilityChange
// ---------------------------------------------------------------------------

func TestPlaybookModifyWithFixes_VisibilityChange(t *testing.T) {
	const (
		teamID   = "team-updated-1"
		memberID = "member-user-id"
	)

	makeLicenseChecker := func() *testLicenseChecker {
		return &testLicenseChecker{allowed: true}
	}

	// newMockAPIForModify returns a mock that grants general team access
	// and system admin checks for the given user, suitable for the
	// PlaybookEdit gate that runs before visibility checks.
	newMockAPIForModify := func(t *testing.T, specificOverrides func(api *plugintest.API)) *plugintest.API {
		t.Helper()
		mockAPI := &plugintest.API{}
		mockAPI.On("RolesGrantPermission", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).
			Return(false).Maybe()
		mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionListTeamChannels).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", memberID, teamID, model.PermissionManageTeam).
			Return(false).Maybe()
		if specificOverrides != nil {
			specificOverrides(mockAPI)
		}
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		return mockAPI
	}

	t.Run("private to public denied without PrivatePlaybookMakePublic permission", func(t *testing.T) {
		oldPlaybook := Playbook{
			ID:     "pb-1",
			TeamID: teamID,
			Public: false,
			Members: []PlaybookMember{
				{UserID: memberID, Roles: []string{PlaybookRoleMember}, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
		newPlaybook := oldPlaybook
		newPlaybook.Public = true

		mockAPI := newMockAPIForModify(t, func(api *plugintest.API) {
			api.On("HasPermissionToTeam", memberID, teamID, model.PermissionPrivatePlaybookMakePublic).
				Return(false).Maybe()
			api.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).
				Return(true).Maybe()
		})

		svc := &PermissionsService{
			pluginAPI:      pluginapi.NewClient(mockAPI, nil),
			licenseChecker: makeLicenseChecker(),
		}

		err := svc.PlaybookModifyWithFixes(memberID, &newPlaybook, oldPlaybook)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "attempted to make playbook public without permissions")
	})

	t.Run("private to public succeeds with PrivatePlaybookMakePublic permission", func(t *testing.T) {
		oldPlaybook := Playbook{
			ID:     "pb-1",
			TeamID: teamID,
			Public: false,
			Members: []PlaybookMember{
				{UserID: memberID, Roles: []string{PlaybookRoleMember}, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
		newPlaybook := oldPlaybook
		newPlaybook.Public = true

		mockAPI := newMockAPIForModify(t, func(api *plugintest.API) {
			api.On("HasPermissionToTeam", memberID, teamID, model.PermissionPrivatePlaybookMakePublic).
				Return(true).Maybe()
			api.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).
				Return(true).Maybe()
		})

		svc := &PermissionsService{
			pluginAPI:      pluginapi.NewClient(mockAPI, nil),
			licenseChecker: makeLicenseChecker(),
		}

		err := svc.PlaybookModifyWithFixes(memberID, &newPlaybook, oldPlaybook)
		require.NoError(t, err)
	})

	t.Run("public to private denied without PublicPlaybookMakePrivate permission", func(t *testing.T) {
		oldPlaybook := Playbook{
			ID:     "pb-1",
			TeamID: teamID,
			Public: true,
			Members: []PlaybookMember{
				{UserID: memberID, Roles: []string{PlaybookRoleMember}, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
		newPlaybook := oldPlaybook
		newPlaybook.Public = false

		mockAPI := newMockAPIForModify(t, func(api *plugintest.API) {
			api.On("HasPermissionToTeam", memberID, teamID, model.PermissionPublicPlaybookMakePrivate).
				Return(false).Maybe()
			api.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).
				Return(true).Maybe()
		})

		svc := &PermissionsService{
			pluginAPI:      pluginapi.NewClient(mockAPI, nil),
			licenseChecker: makeLicenseChecker(),
		}

		err := svc.PlaybookModifyWithFixes(memberID, &newPlaybook, oldPlaybook)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "attempted to make playbook private without permissions")
	})

	t.Run("no visibility change skips conversion permission checks", func(t *testing.T) {
		oldPlaybook := Playbook{
			ID:     "pb-1",
			TeamID: teamID,
			Public: false,
			Members: []PlaybookMember{
				{UserID: memberID, Roles: []string{PlaybookRoleMember}, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
		newPlaybook := oldPlaybook

		mockAPI := newMockAPIForModify(t, func(api *plugintest.API) {
			api.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.Anything).
				Return(true).Maybe()
		})

		svc := &PermissionsService{
			pluginAPI:      pluginapi.NewClient(mockAPI, nil),
			licenseChecker: makeLicenseChecker(),
		}

		err := svc.PlaybookModifyWithFixes(memberID, &newPlaybook, oldPlaybook)
		require.NoError(t, err)
	})
}

// testLicenseChecker is a minimal stub for license checking in permission tests.
type testLicenseChecker struct {
	allowed bool
}

func (c *testLicenseChecker) PlaybookAllowed(isPlaybookPublic bool) bool {
	return c.allowed
}

func (c *testLicenseChecker) RetrospectiveAllowed() bool        { return true }
func (c *testLicenseChecker) TimelineAllowed() bool             { return true }
func (c *testLicenseChecker) StatsAllowed() bool                { return true }
func (c *testLicenseChecker) ChecklistItemDueDateAllowed() bool { return true }
func (c *testLicenseChecker) PlaybookAttributesAllowed() bool   { return true }
func (c *testLicenseChecker) ConditionalPlaybooksAllowed() bool { return true }

