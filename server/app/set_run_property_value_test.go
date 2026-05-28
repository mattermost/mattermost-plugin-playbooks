// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestUpsertRunPropertyValueWithField verifies that UpsertRunPropertyValueWithField
// validates a user-type field value without calling GetPropertyField. The method
// receives an already-loaded PropertyField, so it must never perform a database lookup
// for the field — that lookup is what caused "sql: no rows" for run-scoped fields.
func TestUpsertRunPropertyValueWithField(t *testing.T) {
	// Use propertyService with nil api to test the pre-API logic.
	// sanitizeAndValidatePropertyValue for user type only validates the ID format
	// and does not call s.api, so these sub-tests run entirely without a plugin API.
	s := &propertyService{}

	// A valid 26-character Mattermost user ID (the format model.IsValidId accepts)
	validUserID := model.NewId()

	userField := &model.PropertyField{
		ID:   model.NewId(),
		Name: "Assigned To",
		Type: model.PropertyFieldTypeUser,
		Attrs: model.StringInterface{
			PropertyAttrsVisibility: PropertyFieldVisibilityAlways,
		},
	}

	t.Run("user-type field accepts valid 26-char user ID without GetPropertyField call", func(t *testing.T) {
		value := json.RawMessage(`"` + validUserID + `"`)

		// sanitizeAndValidatePropertyValue is the pre-API step of UpsertRunPropertyValueWithField.
		// If GetPropertyField were called here, it would panic (nil api). The fact that
		// this succeeds proves the method does NOT call GetPropertyField for user-type fields.
		result, err := s.sanitizeAndValidatePropertyValue(userField, value, true)

		require.NoError(t, err)
		require.NotNil(t, result)
		var got string
		require.NoError(t, json.Unmarshal(result, &got))
		require.Equal(t, validUserID, got)
	})

	t.Run("user-type field rejects value that is not a 26-char ID", func(t *testing.T) {
		// A plain string that fails model.IsValidId
		value := json.RawMessage(`"not-a-valid-id"`)

		_, err := s.sanitizeAndValidatePropertyValue(userField, value, true)

		require.Error(t, err)
		require.Contains(t, err.Error(), "valid 26-character ID")
	})

	t.Run("user-type field rejects non-string JSON value", func(t *testing.T) {
		value := json.RawMessage(`123`)

		_, err := s.sanitizeAndValidatePropertyValue(userField, value, true)

		require.Error(t, err)
		require.Contains(t, err.Error(), "user field value must be a string")
	})

	t.Run("user-type field passes through null without GetPropertyField call", func(t *testing.T) {
		value := json.RawMessage(`null`)

		result, err := s.sanitizeAndValidatePropertyValue(userField, value, true)

		require.NoError(t, err)
		require.Equal(t, "null", string(result))
	})
}

// stubLicenseCheckerNoAttributes is a LicenseChecker that reports no premium
// attributes are allowed. Used to avoid a nil panic in GetPlaybookRun while
// keeping property-field loading disabled so the stub store controls the run.
type stubLicenseCheckerNoAttributes struct{}

func (s *stubLicenseCheckerNoAttributes) PlaybookAllowed(_ bool) bool       { return true }
func (s *stubLicenseCheckerNoAttributes) RetrospectiveAllowed() bool        { return false }
func (s *stubLicenseCheckerNoAttributes) TimelineAllowed() bool             { return false }
func (s *stubLicenseCheckerNoAttributes) StatsAllowed() bool                { return false }
func (s *stubLicenseCheckerNoAttributes) ChecklistItemDueDateAllowed() bool { return false }
func (s *stubLicenseCheckerNoAttributes) PlaybookAttributesAllowed() bool   { return false }
func (s *stubLicenseCheckerNoAttributes) ConditionalPlaybooksAllowed() bool { return false }

// stubRunStoreGetOnly is a minimal PlaybookRunStore stub that supports only
// GetPlaybookRun. All other methods panic so that any unexpected call is
// immediately visible during testing.
type stubRunStoreGetOnly struct {
	run *PlaybookRun
	err error
}

func (s *stubRunStoreGetOnly) GetPlaybookRun(playbookRunID string) (*PlaybookRun, error) {
	return s.run, s.err
}

func (s *stubRunStoreGetOnly) GetPlaybookRuns(_ RequesterInfo, _ PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) CreatePlaybookRun(_ *PlaybookRun) (*PlaybookRun, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) UpdatePlaybookRun(_ *PlaybookRun) (*PlaybookRun, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GraphqlUpdate(_ string, _ map[string]interface{}) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) UpdateStatus(_ *SQLStatusPost) error { panic("not implemented") }
func (s *stubRunStoreGetOnly) FinishPlaybookRun(_ string, _ int64) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) RestorePlaybookRun(_ string, _ int64) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetTimelineEvent(_, _ string) (*TimelineEvent, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) CreateTimelineEvent(_ *TimelineEvent) (*TimelineEvent, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) UpdateTimelineEvent(_ *TimelineEvent) error { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetPlaybookRunIDsForChannel(_ string) ([]string, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetHistoricalPlaybookRunParticipantsCount(_ string) (int64, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetOwners(_ RequesterInfo, _ PlaybookRunFilterOptions) ([]OwnerInfo, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) NukeDB() error { panic("not implemented") }
func (s *stubRunStoreGetOnly) ChangeCreationDate(_ string, _ time.Time) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetBroadcastChannelIDsToRootIDs(_ string) (map[string]string, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) SetBroadcastChannelIDsToRootID(_ string, _ map[string]string) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetRunsWithAssignedTasks(_ string) ([]AssignedRun, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetParticipatingRuns(_ string) ([]RunLink, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetOverdueUpdateRuns(_ string) ([]RunLink, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) Follow(_, _ string) error                    { panic("not implemented") }
func (s *stubRunStoreGetOnly) Unfollow(_, _ string) error                  { panic("not implemented") }
func (s *stubRunStoreGetOnly) UnfollowMultiple(_ string, _ []string) error { panic("not implemented") }
func (s *stubRunStoreGetOnly) FollowBatch(_ string, _ []string) error      { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetFollowers(_ string) ([]string, error)     { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetRunsActiveTotal() (int64, error)          { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetOverdueUpdateRunsTotal() (int64, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetOverdueRetroRunsTotal() (int64, error) { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetFollowersActiveTotal() (int64, error)  { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetParticipantsActiveTotal() (int64, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) AddParticipants(_ string, _ []string) error { panic("not implemented") }
func (s *stubRunStoreGetOnly) RemoveParticipants(_ string, _ []string) error {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetSchemeRolesForChannel(_ string) (string, string, string, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetSchemeRolesForTeam(_ string) (string, string, string, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetPlaybookRunIDsForUser(_ string) ([]string, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetStatusPostsByIDs(_ []string) (map[string][]StatusPost, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetTimelineEventsByIDs(_ []string) ([]TimelineEvent, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) GetMetricsByIDs(_ []string) (map[string][]RunMetricData, error) {
	panic("not implemented")
}
func (s *stubRunStoreGetOnly) BumpRunUpdatedAt(_ string) error { panic("not implemented") }
func (s *stubRunStoreGetOnly) GetRunIDsByParentFieldValue(_, _, _ string, _ int) ([]string, error) {
	panic("not implemented")
}

// TestSetRunPropertyValue_FieldOwnershipValidation covers the guard added at
// server/app/playbook_run_service.go:4897: if propertyField is not found in
// run.PropertyFields the method must return an error immediately, before any
// store writes.
func TestSetRunPropertyValue_FieldOwnershipValidation(t *testing.T) {
	fieldID := model.NewId()
	runID := model.NewId()

	runWithField := &PlaybookRun{
		ID: runID,
		PropertyFields: []PropertyField{
			{PropertyField: model.PropertyField{ID: fieldID, Name: "priority", Type: "text"}},
		},
	}

	runWithoutField := &PlaybookRun{
		ID:             runID,
		PropertyFields: []PropertyField{},
	}

	t.Run("field not in run returns error without store writes", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{
			store:          &stubRunStoreGetOnly{run: runWithoutField},
			licenseChecker: &stubLicenseCheckerNoAttributes{},
		}

		_, err := svc.SetRunPropertyValue("user1", runID, fieldID, json.RawMessage(`"high"`))

		require.Error(t, err)
		require.Contains(t, err.Error(), "does not belong to run")
	})

	t.Run("store error on GetPlaybookRun propagates", func(t *testing.T) {
		storeErr := errors.New("db unavailable")
		svc := &PlaybookRunServiceImpl{
			store:          &stubRunStoreGetOnly{err: storeErr},
			licenseChecker: &stubLicenseCheckerNoAttributes{},
		}

		_, err := svc.SetRunPropertyValue("user1", runID, fieldID, json.RawMessage(`"high"`))

		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to get playbook run")
	})

	t.Run("field belonging to a different run is rejected", func(t *testing.T) {
		differentFieldID := model.NewId()
		svc := &PlaybookRunServiceImpl{
			store:          &stubRunStoreGetOnly{run: runWithField},
			licenseChecker: &stubLicenseCheckerNoAttributes{},
		}

		_, err := svc.SetRunPropertyValue("user1", runID, differentFieldID, json.RawMessage(`"high"`))

		require.Error(t, err)
		require.Contains(t, err.Error(), "does not belong to run")
	})
}
