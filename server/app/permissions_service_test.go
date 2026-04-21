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
func (s *stubRunService) CreatePlaybookRun(*PlaybookRun, *Playbook, string, bool) (*PlaybookRun, error) {
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

	// makePlaybook builds a Playbook with the given OwnerGroupOnlyActions setting and
	// a Members list that includes ownerID, memberID and pbAdminID.
	makePlaybook := func(ownerOnly bool) Playbook {
		return Playbook{
			ID:                    pbID,
			OwnerGroupOnlyActions: ownerOnly,
			Members: []PlaybookMember{
				{
					UserID:      pbAdminID,
					Roles:       []string{PlaybookRoleAdmin, PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember},
				},
				{
					UserID:      memberID,
					Roles:       []string{PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleMember},
				},
				{
					UserID:      ownerID,
					Roles:       []string{PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleMember},
				},
			},
		}
	}

	// baseRun is a playbook-based run whose owner is ownerID.
	baseRun := &PlaybookRun{
		ID:             runID,
		PlaybookID:     pbID,
		TeamID:         "team-1",
		OwnerUserID:    ownerID,
		ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
		Type:           RunTypePlaybook,
	}

	t.Run("OwnerGroupOnlyActions false allows any participant", func(t *testing.T) {
		pb := makePlaybook(false)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPluginAPIAllowingAdmins(t), // pluginAPI needed for canViewTeam in runManagePropertiesWithPlaybookRun
		)

		err := svc.RunFinish(memberID, runID)

		require.NoError(t, err)
	})

	t.Run("OwnerGroupOnlyActions true allows owner", func(t *testing.T) {
		pb := makePlaybook(true)
		// ownerID == run.OwnerUserID → returns nil before IsSystemAdmin is called.
		// Pass a pluginAPI anyway so that if the implementation inadvertently calls
		// IsSystemAdmin it will not panic.
		pluginAPI := newPluginAPIAllowingAdmins(t) // ownerID is NOT a system admin
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginAPI,
		)

		err := svc.RunFinish(ownerID, runID)

		require.NoError(t, err)
	})

	t.Run("OwnerGroupOnlyActions true allows system admin", func(t *testing.T) {
		pb := makePlaybook(true)
		pluginAPI := newPluginAPIAllowingAdmins(t, adminID)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginAPI,
		)

		err := svc.RunFinish(adminID, runID)

		require.NoError(t, err)
	})

	t.Run("OwnerGroupOnlyActions true rejects playbook admin who is not owner", func(t *testing.T) {
		pb := makePlaybook(true)
		runWithOwnerOnly := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
			Return(true).Maybe()
		// pbAdminID is NOT a system admin
		mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		pluginAPI := pluginapi.NewClient(mockAPI, nil)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithOwnerOnly, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginAPI,
		)

		err := svc.RunFinish(pbAdminID, runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions for playbook admin who is not owner; got: %v", err)
	})

	t.Run("OwnerGroupOnlyActions true rejects non-owner non-admin participant", func(t *testing.T) {
		pb := makePlaybook(true)
		runWithOwnerOnly := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
			Return(true).Maybe()
		// memberID is NOT a system admin
		mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		pluginAPI := pluginapi.NewClient(mockAPI, nil)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithOwnerOnly, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginAPI,
		)

		err := svc.RunFinish(memberID, runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions for non-owner non-admin; got: %v", err)
	})

	t.Run("channel checklist run has no restriction regardless of OwnerGroupOnlyActions", func(t *testing.T) {
		channelChecklistRun := &PlaybookRun{
			ID:          runID,
			PlaybookID:  pbID,
			TeamID:      "team-1",
			OwnerUserID: ownerID,
			ChannelID:   "channel-1",
			Type:        RunTypeChannelChecklist,
		}
		pb := makePlaybook(true) // OwnerGroupOnlyActions=true, but should be ignored
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).Return(true).Maybe()
		mockAPI.On("GetChannel", "channel-1").Return(&model.Channel{Id: "channel-1"}, nil).Maybe()
		mockAPI.On("HasPermissionToChannel", memberID, "channel-1", model.PermissionCreatePost).Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelChecklistRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginapi.NewClient(mockAPI, nil),
		)

		err := svc.RunFinish(memberID, runID)

		require.NoError(t, err, "channel checklist runs must not be subject to OwnerGroupOnlyActions")
	})

	t.Run("standalone run with empty PlaybookID has no restriction", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID:             runID,
			PlaybookID:     "", // standalone — no associated playbook
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID},
			Type:           RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			&stubPlaybookService{},
			newPluginAPIAllowingAdmins(t), // pluginAPI needed for canViewTeam in runManagePropertiesWithPlaybookRun
		)

		err := svc.RunFinish(memberID, runID)

		require.NoError(t, err, "standalone runs (empty PlaybookID) must not be subject to OwnerGroupOnlyActions")
	})

	t.Run("deleted playbook allows owner", func(t *testing.T) {
		runWithDeletedPlaybook := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		pluginAPI := newPluginAPIAllowingAdmins(t) // ownerID is NOT a system admin
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithDeletedPlaybook, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			pluginAPI,
		)

		err := svc.RunFinish(ownerID, runID)

		require.NoError(t, err, "owner must still be allowed to finish even when the playbook has been deleted")
	})

	t.Run("deleted playbook allows system admin", func(t *testing.T) {
		runWithDeletedPlaybook := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		pluginAPI := newPluginAPIAllowingAdmins(t, adminID)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithDeletedPlaybook, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			pluginAPI,
		)

		err := svc.RunFinish(adminID, runID)

		require.NoError(t, err, "system admin must be allowed to finish even when the playbook has been deleted")
	})

	t.Run("deleted playbook rejects non-owner non-admin", func(t *testing.T) {
		runWithDeletedPlaybook := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		pluginAPI := newPluginAPIAllowingAdmins(t) // memberID is NOT a system admin
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithDeletedPlaybook, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			pluginAPI,
		)

		err := svc.RunFinish(memberID, runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"non-owner/non-admin must be denied finish when the playbook has been deleted; got: %v", err)
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
			OwnerGroupOnlyActions: ownerOnly,
			Members: []PlaybookMember{
				{
					UserID:      pbAdminID,
					Roles:       []string{PlaybookRoleAdmin, PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleAdmin, PlaybookRoleMember},
				},
				{
					UserID:      memberID,
					Roles:       []string{PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleMember},
				},
				{
					UserID:      ownerID,
					Roles:       []string{PlaybookRoleMember},
					SchemeRoles: []string{PlaybookRoleMember},
				},
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

	// newPermissivePluginAPI returns a pluginAPI that grants all team view
	// permissions (needed by RunManageProperties) and admin checks.
	newPermissivePluginAPI := func(t *testing.T, adminIDs ...string) *pluginapi.Client {
		t.Helper()
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
			Return(true).Maybe()
		// Default: no user is a team admin unless explicitly configured.
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionManageTeam).
			Return(false).Maybe()
		for _, id := range adminIDs {
			mockAPI.On("HasPermissionTo", id, model.PermissionManageSystem).
				Return(true).Maybe()
		}
		mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
			Return(false).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		return pluginapi.NewClient(mockAPI, nil)
	}

	t.Run("OwnerGroupOnlyActions false allows any participant — no restriction", func(t *testing.T) {
		pb := makePlaybook(false)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.NoError(t, err, "when OwnerGroupOnlyActions=false any participant may change ownership")
	})

	t.Run("OwnerGroupOnlyActions true allows current owner", func(t *testing.T) {
		pb := makePlaybook(true)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(ownerID, runID)

		require.NoError(t, err)
	})

	t.Run("OwnerGroupOnlyActions true allows system admin", func(t *testing.T) {
		pb := makePlaybook(true)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPermissivePluginAPI(t, adminID),
		)

		err := svc.RunChangeOwner(adminID, runID)

		require.NoError(t, err)
	})

	t.Run("OwnerGroupOnlyActions true allows playbook admin to change owner", func(t *testing.T) {
		pb := makePlaybook(true)
		svc := newPermissionsServiceForTest(
			&stubRunService{run: baseRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(pbAdminID, runID)

		require.NoError(t, err, "playbook admins should be allowed to change owner for legitimate handoffs")
	})

	t.Run("OwnerGroupOnlyActions true rejects non-owner non-admin participant", func(t *testing.T) {
		pb := makePlaybook(true)
		runWithOwnerOnly := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithOwnerOnly, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})

	t.Run("channel checklist run has no restriction", func(t *testing.T) {
		channelChecklistRun := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{memberID},
			ChannelID:      "ch-1",
			Type:           RunTypeChannelChecklist,
		}
		pb := makePlaybook(true)
		mockAPI := &plugintest.API{}
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("GetChannel", "ch-1").
			Return(&model.Channel{Id: "ch-1"}, nil).Maybe()
		mockAPI.On("HasPermissionToChannel", memberID, "ch-1", model.PermissionCreatePost).
			Return(true).Maybe()
		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		svc := newPermissionsServiceForTest(
			&stubRunService{run: channelChecklistRun, err: nil},
			&stubPlaybookService{playbook: pb, err: nil},
			pluginapi.NewClient(mockAPI, nil),
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.NoError(t, err, "channel checklist runs must not be subject to RunChangeOwner restriction")
	})

	t.Run("standalone run with empty PlaybookID has no restriction", func(t *testing.T) {
		standaloneRun := &PlaybookRun{
			ID:             runID,
			PlaybookID:     "",
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{memberID},
			Type:           RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: standaloneRun, err: nil},
			&stubPlaybookService{},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.NoError(t, err, "standalone runs must not be subject to RunChangeOwner restriction")
	})

	t.Run("deleted playbook allows owner to reassign ownership", func(t *testing.T) {
		runWithDeletedPlaybook := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithDeletedPlaybook, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(ownerID, runID)

		require.NoError(t, err, "owner must be allowed to reassign ownership even when the playbook is deleted")
	})

	t.Run("deleted playbook rejects non-owner non-admin for ownership reassignment", func(t *testing.T) {
		runWithDeletedPlaybook := &PlaybookRun{
			ID:             runID,
			PlaybookID:     pbID,
			TeamID:         "team-1",
			OwnerUserID:    ownerID,
			ParticipantIDs: []string{ownerID, memberID, pbAdminID, adminID},
			Type:           RunTypePlaybook,
		}
		svc := newPermissionsServiceForTest(
			&stubRunService{run: runWithDeletedPlaybook, err: nil},
			&stubPlaybookService{playbook: Playbook{}, err: ErrNotFound},
			newPermissivePluginAPI(t),
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"non-owner/non-admin must be denied when the playbook is deleted; got: %v", err)
	})

	t.Run("run not found propagates error without panic", func(t *testing.T) {
		notFoundErr := errors.New("run not found in store")
		svc := newPermissionsServiceForTest(
			&stubRunService{run: nil, err: notFoundErr},
			&stubPlaybookService{},
			nil, // pluginAPI must never be reached
		)

		err := svc.RunChangeOwner(memberID, runID)

		require.Error(t, err)
		assert.False(t, errors.Is(err, ErrNoPermissions),
			"a missing-run error must propagate as-is, not be wrapped in ErrNoPermissions")
	})
}


// TestIsPlaybookAdminMember tests the IsPlaybookAdminMember package-level helper
// that supports the AdminOnlyEdit permission check and the
// assertCanModifyTaskState lockdown bypass.
//
// It returns true when the user's SchemeRoles contains PlaybookRoleAdmin.
func TestIsPlaybookAdminMember(t *testing.T) {
	adminID := "user-admin"
	memberID := "user-member"
	outsiderID := "user-outsider"

	playbook := Playbook{
		ID: "pb-1",
		Members: []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
		},
	}

	t.Run("admin member returns true", func(t *testing.T) {
		result := IsPlaybookAdminMember(adminID, playbook)
		require.True(t, result)
	})

	t.Run("regular member returns false", func(t *testing.T) {
		result := IsPlaybookAdminMember(memberID, playbook)
		require.False(t, result)
	})

	t.Run("non-member returns false", func(t *testing.T) {
		result := IsPlaybookAdminMember(outsiderID, playbook)
		require.False(t, result)
	})

	t.Run("empty members list returns false", func(t *testing.T) {
		pb := Playbook{ID: "pb-2", Members: []PlaybookMember{}}
		result := IsPlaybookAdminMember(adminID, pb)
		require.False(t, result)
	})

	t.Run("user with both member and admin scheme roles returns true", func(t *testing.T) {
		pb := Playbook{
			ID: "pb-3",
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: []string{PlaybookRoleMember, PlaybookRoleAdmin}},
			},
		}
		result := IsPlaybookAdminMember(adminID, pb)
		require.True(t, result)
	})

	t.Run("user with nil scheme roles returns false", func(t *testing.T) {
		pb := Playbook{
			ID: "pb-4",
			Members: []PlaybookMember{
				{UserID: adminID, SchemeRoles: nil},
			},
		}
		result := IsPlaybookAdminMember(adminID, pb)
		require.False(t, result)
	})
}
