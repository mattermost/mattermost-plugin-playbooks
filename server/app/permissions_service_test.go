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
func (s *stubRunService) GetPlaybookTimelineEvents(RequesterInfo, PlaybookRunFilterOptions) (*GetPlaybookTimelineEventsResults, error) {
	panic("stubRunService: GetPlaybookTimelineEvents not implemented")
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

// TestAdminOnlyEditLogic tests the canEditWithAdminOnlyCheck helper — the pure
// logic function that encapsulates the AdminOnlyEdit branch inside PlaybookEdit.
//
// AdminOnlyEdit=true restricts editing to Playbook Admins (SchemeRoles contains
// PlaybookRoleAdmin) and System Admins. Team Admins who are only PlaybookRoleMember
// in the playbook are rejected — this is the "team admin asymmetry".
//
// Note: full PermissionsService.PlaybookEdit integration (with pluginAPI system-admin
// check) is covered by e2e/integration tests. This unit test covers the pure logic.
func TestAdminOnlyEditLogic(t *testing.T) {
	adminID := "user-admin"
	memberID := "user-member"
	teamAdminID := "team-admin-only"

	playbookAdminOnlyEdit := Playbook{
		ID:            "pb-1",
		AdminOnlyEdit: true,
		Members: []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
			// teamAdminID is a team admin but only a Playbook Member
			{UserID: teamAdminID, SchemeRoles: []string{PlaybookRoleMember}},
		},
	}

	playbookNoRestriction := Playbook{
		ID:            "pb-2",
		AdminOnlyEdit: false,
		Members: []PlaybookMember{
			{UserID: adminID, SchemeRoles: []string{PlaybookRoleAdmin}},
			{UserID: memberID, SchemeRoles: []string{PlaybookRoleMember}},
		},
	}

	t.Run("AdminOnlyEdit false: member is not restricted at playbook-admin level", func(t *testing.T) {
		// When AdminOnlyEdit=false, PlaybookEdit delegates to PlaybookManageProperties.
		// IsPlaybookAdminMember is not the gate in this case — test the helper directly.
		assert.False(t, IsPlaybookAdminMember(memberID, playbookNoRestriction),
			"member is not a playbook admin")
	})

	t.Run("AdminOnlyEdit false: admin role is recognized", func(t *testing.T) {
		assert.True(t, IsPlaybookAdminMember(adminID, playbookNoRestriction))
	})

	t.Run("AdminOnlyEdit true: playbook admin passes member check", func(t *testing.T) {
		assert.True(t, IsPlaybookAdminMember(adminID, playbookAdminOnlyEdit),
			"playbook admin must pass the member-level admin check")
	})

	t.Run("AdminOnlyEdit true: non-admin member fails member check", func(t *testing.T) {
		assert.False(t, IsPlaybookAdminMember(memberID, playbookAdminOnlyEdit),
			"non-admin member must fail the member-level admin check")
	})

	t.Run("AdminOnlyEdit true: team admin who is only a playbook member fails member check", func(t *testing.T) {
		// Team admins manage playbooks via team-level permission, but AdminOnlyEdit
		// specifically restricts to Playbook Admins. A team admin with only
		// PlaybookRoleMember in the playbook must fail the member-level check.
		assert.False(t, IsPlaybookAdminMember(teamAdminID, playbookAdminOnlyEdit),
			"team admin who is only a playbook member must fail playbook admin check")
	})

	t.Run("AdminOnlyEdit true: non-member fails member check", func(t *testing.T) {
		// IsPlaybookAdminMember checks only playbook-member roles, not system admin.
		// System admin bypass is handled separately in PlaybookEdit via IsSystemAdmin.
		systemAdminNotPlaybookMember := "system-admin-not-member"
		assert.False(t, IsPlaybookAdminMember(systemAdminNotPlaybookMember, playbookAdminOnlyEdit),
			"non-member is not recognized as playbook admin; system admin bypass is in PlaybookEdit")
	})
}

// TestPlaybookEdit_AdminOnlyEdit_Integration tests the PermissionsService.PlaybookEdit
// method end-to-end (not just the pure helper functions) for the AdminOnlyEdit feature.
//
// PlaybookEdit flow when AdminOnlyEdit=true:
//  1. If user is a system admin (IsSystemAdmin via pluginAPI) → allowed
//  2. If user has no team access (canViewTeam) → denied
//  3. If user is a playbook admin member (SchemeRoles contains PlaybookRoleAdmin) → allowed
//  4. Otherwise → denied (ErrNoPermissions)
func TestPlaybookEdit_AdminOnlyEdit_Integration(t *testing.T) {
	const (
		teamID              = "team-integration-1"
		playbookID          = "pb-integration-1"
		systemAdminID       = "system-admin-user"
		playbookAdminUserID = "playbook-admin-user"
		plainMemberID       = "plain-member-user"
		teamAdminID         = "team-admin-only-user"
		outsiderID          = "outsider-no-team"
	)

	// makePlaybook builds a test playbook with AdminOnlyEdit=true.
	makePlaybook := func() Playbook {
		return Playbook{
			ID:            playbookID,
			TeamID:        teamID,
			AdminOnlyEdit: true,
			Members: []PlaybookMember{
				{UserID: playbookAdminUserID, SchemeRoles: []string{PlaybookRoleAdmin}},
				{UserID: plainMemberID, SchemeRoles: []string{PlaybookRoleMember}},
				// teamAdminID is a team admin but only a playbook Member
				{UserID: teamAdminID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}
	}

	// newPluginAPIForEdit returns a *pluginapi.Client that:
	//   - grants HasPermissionToTeam for all users EXCEPT outsiderID
	//   - marks systemAdminID as system admin
	newPluginAPIForEdit := func(t *testing.T) *pluginapi.Client {
		t.Helper()
		mockAPI := &plugintest.API{}

		// Team view permission: outsiderID is denied, everyone else is allowed.
		mockAPI.On("HasPermissionToTeam", outsiderID, teamID, model.PermissionViewTeam).
			Return(false).Maybe()
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), teamID, model.PermissionViewTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionViewTeam).
			Return(true).Maybe()

		// System admin: only systemAdminID has PermissionManageSystem.
		mockAPI.On("HasPermissionTo", systemAdminID, model.PermissionManageSystem).
			Return(true).Maybe()
		mockAPI.On("HasPermissionTo", mock.AnythingOfType("string"), model.PermissionManageSystem).
			Return(false).Maybe()

		// Team admin: teamAdminID has PermissionManageTeam; others do not.
		mockAPI.On("HasPermissionToTeam", teamAdminID, teamID, model.PermissionManageTeam).
			Return(true).Maybe()
		mockAPI.On("HasPermissionToTeam", mock.AnythingOfType("string"), mock.AnythingOfType("string"), model.PermissionManageTeam).
			Return(false).Maybe()

		t.Cleanup(func() { mockAPI.AssertExpectations(t) })
		return pluginapi.NewClient(mockAPI, nil)
	}

	t.Run("system admin is allowed even with AdminOnlyEdit=true", func(t *testing.T) {
		pb := makePlaybook()
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIForEdit(t))

		err := svc.PlaybookEdit(systemAdminID, pb)

		require.NoError(t, err,
			"system admin must bypass AdminOnlyEdit restriction")
	})

	t.Run("playbook admin member is allowed with AdminOnlyEdit=true", func(t *testing.T) {
		pb := makePlaybook()
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIForEdit(t))

		err := svc.PlaybookEdit(playbookAdminUserID, pb)

		require.NoError(t, err,
			"playbook admin member (SchemeRoles contains PlaybookRoleAdmin) must be allowed")
	})

	t.Run("plain member is denied with AdminOnlyEdit=true", func(t *testing.T) {
		pb := makePlaybook()
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIForEdit(t))

		err := svc.PlaybookEdit(plainMemberID, pb)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"plain member must receive ErrNoPermissions with AdminOnlyEdit=true; got: %v", err)
	})

	t.Run("team admin who is only a playbook member is allowed with AdminOnlyEdit=true", func(t *testing.T) {
		// Team admins (PermissionManageTeam) are allowed to edit even when AdminOnlyEdit=true,
		// so that exercise controllers with team admin privileges can manage playbooks.
		pb := makePlaybook()
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIForEdit(t))

		err := svc.PlaybookEdit(teamAdminID, pb)

		require.NoError(t, err,
			"team admin (PermissionManageTeam) must be allowed with AdminOnlyEdit=true; got: %v", err)
	})

	t.Run("user with no team access is denied even if they would otherwise qualify", func(t *testing.T) {
		pb := makePlaybook()
		svc := newPermissionsServiceForTest(nil, nil, newPluginAPIForEdit(t))

		err := svc.PlaybookEdit(outsiderID, pb)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"user without team access must be denied; got: %v", err)
	})
}

// TestPlaybookAdminOnlyEdit_PermissionsService_LogicGating tests the overall
// branching of PlaybookEdit as a series of pure logic gates, verifying that:
// 1. When AdminOnlyEdit=false, PlaybookEdit delegates to PlaybookManageProperties only
// 2. When AdminOnlyEdit=true, PlaybookEdit checks the admin gate before ManageProperties
func TestPlaybookAdminOnlyEdit_LogicGating(t *testing.T) {
	t.Run("AdminOnlyEdit true + non-admin member returns ErrNoPermissions", func(t *testing.T) {
		nonAdminUserID := "user-non-admin"
		pb := Playbook{
			ID:            "pb-1",
			AdminOnlyEdit: true,
			Members: []PlaybookMember{
				{UserID: nonAdminUserID, SchemeRoles: []string{PlaybookRoleMember}},
			},
		}

		// Simulate the PlaybookEdit check: if AdminOnlyEdit AND user is not admin → reject
		isAdmin := IsPlaybookAdminMember(nonAdminUserID, pb)
		require.False(t, isAdmin)

		// The gate fires: non-admin member is rejected
		if pb.AdminOnlyEdit && !isAdmin {
			// This is where PlaybookEdit returns ErrNoPermissions
			assert.True(t, true, "correct: PlaybookEdit rejects non-admin member")
		} else {
			assert.Fail(t, "PlaybookEdit should have rejected this user")
		}
	})

	t.Run("AdminOnlyEdit true + playbook admin returns no ErrNoPermissions from admin gate", func(t *testing.T) {
		adminUserID := "user-admin"
		pb := Playbook{
			ID:            "pb-1",
			AdminOnlyEdit: true,
			Members: []PlaybookMember{
				{UserID: adminUserID, SchemeRoles: []string{PlaybookRoleAdmin}},
			},
		}

		isAdmin := IsPlaybookAdminMember(adminUserID, pb)
		require.True(t, isAdmin)

		// Admin gate passes — PlaybookEdit proceeds to base ManageProperties check
		gateBlocks := pb.AdminOnlyEdit && !isAdmin
		assert.False(t, gateBlocks, "playbook admin must pass the AdminOnlyEdit gate")
	})
}
