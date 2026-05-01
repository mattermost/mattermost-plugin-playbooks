// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"testing"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

// stubUpsertPropertyService implements PropertyService with only UpsertRunPropertyValueWithField wired.
type stubUpsertPropertyService struct {
	upsertErr    error
	upsertCalled int
}

func (s *stubUpsertPropertyService) UpsertRunPropertyValueWithField(_ string, f *PropertyField, _ json.RawMessage) (*PropertyValue, error) {
	s.upsertCalled++
	if s.upsertErr != nil {
		return nil, s.upsertErr
	}
	return &PropertyValue{FieldID: f.ID}, nil
}

// Panicking stubs for the rest of the PropertyService interface.
func (s *stubUpsertPropertyService) CreatePropertyField(_ string, _ PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetPropertyField(_ string) (*PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetPropertyFields(_ string) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetPropertyFieldsSince(_ string, _ int64) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetPropertyFieldsCount(_ string) (int, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunPropertyFields(_ string) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunPropertyFieldsSince(_ string, _ int64) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunPropertyValues(_ string) ([]PropertyValue, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunPropertyValuesSince(_ string, _ int64) ([]PropertyValue, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunPropertyValueByFieldID(_, _ string) (*PropertyValue, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) UpdatePropertyField(_ string, _ PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) DeletePropertyField(_, _ string) error { panic("not called") }
func (s *stubUpsertPropertyService) ReorderPropertyFields(_, _ string, _ int) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) CopyPlaybookPropertiesToRun(_, _ string) (*PropertyCopyResult, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) CopyPlaybookPropertiesToPlaybook(_, _ string) (*PropertyCopyResult, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) UpsertRunPropertyValue(_, _ string, _ json.RawMessage) (*PropertyValue, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) SanitizePropertyValue(_ mm_model.PropertyFieldType, _ json.RawMessage) (json.RawMessage, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunsPropertyFields(_ []string) (map[string][]PropertyField, error) {
	panic("not called")
}
func (s *stubUpsertPropertyService) GetRunsPropertyValues(_ []string) (map[string][]PropertyValue, error) {
	panic("not called")
}

// stubUpsertPropertyServiceCapture is like stubUpsertPropertyService but also records the last value passed to UpsertRunPropertyValueWithField.
type stubUpsertPropertyServiceCapture struct {
	stubUpsertPropertyService
	lastValue json.RawMessage
}

func (s *stubUpsertPropertyServiceCapture) UpsertRunPropertyValueWithField(_ string, f *PropertyField, v json.RawMessage) (*PropertyValue, error) {
	s.upsertCalled++
	s.lastValue = v
	if s.upsertErr != nil {
		return nil, s.upsertErr
	}
	return &PropertyValue{FieldID: f.ID}, nil
}

// stubPBServiceRunNumber implements PlaybookService with only IncrementRunNumber wired.
type stubPBServiceRunNumber struct {
	nextNum int64
	err     error
}

func (s *stubPBServiceRunNumber) IncrementRunNumber(_ string) (int64, error) {
	return s.nextNum, s.err
}
func (s *stubPBServiceRunNumber) Create(_ Playbook, _ string) (string, error) { panic("not called") }
func (s *stubPBServiceRunNumber) Get(_ string) (Playbook, error)              { panic("not called") }
func (s *stubPBServiceRunNumber) GetPlaybooks() ([]Playbook, error)           { panic("not called") }
func (s *stubPBServiceRunNumber) GetActivePlaybooks() ([]Playbook, error)     { panic("not called") }
func (s *stubPBServiceRunNumber) GetPlaybooksForTeam(_ RequesterInfo, _ string, _ PlaybookFilterOptions) (GetPlaybooksResults, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) Update(_ Playbook, _ string) error         { panic("not called") }
func (s *stubPBServiceRunNumber) Archive(_ Playbook, _ string) error        { panic("not called") }
func (s *stubPBServiceRunNumber) Restore(_ Playbook, _ string) error        { panic("not called") }
func (s *stubPBServiceRunNumber) AutoFollow(_, _ string) error              { panic("not called") }
func (s *stubPBServiceRunNumber) AutoUnfollow(_, _ string) error            { panic("not called") }
func (s *stubPBServiceRunNumber) GetAutoFollows(_ string) ([]string, error) { panic("not called") }
func (s *stubPBServiceRunNumber) Duplicate(_ Playbook, _ string) (string, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) GetTopPlaybooksForTeam(_, _ string, _ *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) GetTopPlaybooksForUser(_, _ string, _ *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) Import(_ PlaybookImportData, _ string) (string, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) GetPlaybookConditionsForExport(_ string) ([]Condition, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) CreatePropertyField(_ string, _ PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) UpdatePropertyField(_ string, _ PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) DeletePropertyField(_, _ string) error { panic("not called") }
func (s *stubPBServiceRunNumber) ReorderPropertyFields(_, _ string, _ int) ([]PropertyField, error) {
	panic("not called")
}
func (s *stubPBServiceRunNumber) UpdateChannelNameTemplateIfUnchanged(_, _, _ string) (bool, error) {
	panic("not called")
}

// ---------------------------------------------------------------------------
// Tests for applyInitialPropertyValues
// ---------------------------------------------------------------------------

func TestApplyInitialPropertyValues(t *testing.T) {
	playbookFieldID := mm_model.NewId()
	runFieldID := mm_model.NewId()

	makeRun := func() *PlaybookRun {
		return &PlaybookRun{ID: mm_model.NewId()}
	}

	makeCopyResult := func() *PropertyCopyResult {
		pf := PropertyField{}
		pf.ID = runFieldID
		pf.Name = "Priority"
		return &PropertyCopyResult{
			CopiedFields:  []PropertyField{pf},
			FieldMappings: map[string]string{playbookFieldID: runFieldID},
		}
	}

	logger := logrus.NewEntry(logrus.StandardLogger())

	t.Run("known field value is upserted and appended to run", func(t *testing.T) {
		stub := &stubUpsertPropertyService{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		result := svc.applyInitialPropertyValues(makeRun(), makeCopyResult(), map[string]json.RawMessage{
			playbookFieldID: json.RawMessage(`"high"`),
		}, logger)

		require.Equal(t, 1, stub.upsertCalled)
		require.Len(t, result.PropertyValues, 1)
		assert.Equal(t, runFieldID, result.PropertyValues[0].FieldID)
	})

	t.Run("unknown playbook field ID is skipped", func(t *testing.T) {
		stub := &stubUpsertPropertyService{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		result := svc.applyInitialPropertyValues(makeRun(), makeCopyResult(), map[string]json.RawMessage{
			"unknown_field_id": json.RawMessage(`"high"`),
		}, logger)

		assert.Equal(t, 0, stub.upsertCalled)
		assert.Empty(t, result.PropertyValues)
	})

	t.Run("nil raw value is skipped", func(t *testing.T) {
		stub := &stubUpsertPropertyService{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		result := svc.applyInitialPropertyValues(makeRun(), makeCopyResult(), map[string]json.RawMessage{
			playbookFieldID: nil,
		}, logger)

		assert.Equal(t, 0, stub.upsertCalled)
		assert.Empty(t, result.PropertyValues)
	})

	t.Run("upsert failure is best-effort and not appended", func(t *testing.T) {
		stub := &stubUpsertPropertyService{upsertErr: errors.New("db error")}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		result := svc.applyInitialPropertyValues(makeRun(), makeCopyResult(), map[string]json.RawMessage{
			playbookFieldID: json.RawMessage(`"high"`),
		}, logger)

		assert.Equal(t, 1, stub.upsertCalled, "upsert was attempted")
		assert.Empty(t, result.PropertyValues, "failed upsert is not appended")
	})

	t.Run("empty initialValues leaves run unchanged", func(t *testing.T) {
		stub := &stubUpsertPropertyService{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		result := svc.applyInitialPropertyValues(makeRun(), makeCopyResult(), map[string]json.RawMessage{}, logger)

		assert.Equal(t, 0, stub.upsertCalled)
		assert.Empty(t, result.PropertyValues)
	})

	t.Run("select field value is translated via OptionMappings before upsert", func(t *testing.T) {
		stub := &stubUpsertPropertyServiceCapture{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		copyResult := makeCopyResult()
		copyResult.OptionMappings = map[string]string{"pb-opt-1": "run-opt-1"}

		result := svc.applyInitialPropertyValues(makeRun(), copyResult, map[string]json.RawMessage{
			playbookFieldID: json.RawMessage(`"pb-opt-1"`),
		}, logger)

		require.Equal(t, 1, stub.upsertCalled)
		require.Len(t, result.PropertyValues, 1)
		assert.Equal(t, json.RawMessage(`"run-opt-1"`), stub.lastValue)
	})

	t.Run("multiselect value with one unknown option ID is dropped before upsert", func(t *testing.T) {
		stub := &stubUpsertPropertyServiceCapture{}
		svc := &PlaybookRunServiceImpl{propertyService: stub}

		copyResult := makeCopyResult()
		copyResult.OptionMappings = map[string]string{"pb-opt-1": "run-opt-1"}

		result := svc.applyInitialPropertyValues(makeRun(), copyResult, map[string]json.RawMessage{
			playbookFieldID: json.RawMessage(`["pb-opt-1","unknown-opt"]`),
		}, logger)

		require.Equal(t, 1, stub.upsertCalled)
		require.Len(t, result.PropertyValues, 1)
		var translated []string
		require.NoError(t, json.Unmarshal(stub.lastValue, &translated))
		assert.Equal(t, []string{"run-opt-1"}, translated)
	})
}

// ---------------------------------------------------------------------------
// Tests for CreatePlaybookRun precondition guards
// ---------------------------------------------------------------------------

func TestCreatePlaybookRun_PreconditionGuards(t *testing.T) {
	t.Run("non-nil pb and empty name returns ErrInternalPrecondition", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{Name: ""}
		pb := &Playbook{ID: mm_model.NewId()}

		_, err := svc.CreatePlaybookRun(run, pb, "user1", true, "", "", nil)

		require.Error(t, err)
		require.True(t, errors.Is(err, ErrInternalPrecondition))
	})

	t.Run("non-nil pb and whitespace-only name returns ErrInternalPrecondition", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{Name: "   "}
		pb := &Playbook{ID: mm_model.NewId()}

		_, err := svc.CreatePlaybookRun(run, pb, "user1", true, "", "", nil)

		require.Error(t, err)
		require.True(t, errors.Is(err, ErrInternalPrecondition))
	})

	t.Run("non-nil pb and RunNumber==0 with non-empty PlaybookID returns ErrInternalPrecondition", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		pbID := mm_model.NewId()
		run := &PlaybookRun{Name: "my run", PlaybookID: pbID, RunNumber: 0}
		pb := &Playbook{ID: pbID}

		_, err := svc.CreatePlaybookRun(run, pb, "user1", true, "", "", nil)

		require.Error(t, err)
		require.True(t, errors.Is(err, ErrInternalPrecondition))
	})

	t.Run("nil pb does not trigger precondition error", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{}
		run := &PlaybookRun{Name: ""}

		// With a zero-value service the call will panic after the precondition guard
		// (nil api field), but we only care that ErrInternalPrecondition is NOT the reason.
		var precondErr error
		func() {
			defer func() { recover() }() //nolint:errcheck
			_, precondErr = svc.CreatePlaybookRun(run, nil, "user1", true, "", "", nil)
		}()

		require.False(t, errors.Is(precondErr, ErrInternalPrecondition))
	})
}

// ---------------------------------------------------------------------------
// Tests for ResolveRunCreationParams
// ---------------------------------------------------------------------------

func TestResolveRunCreationParams_NilPlaybook(t *testing.T) {
	svc := &PlaybookRunServiceImpl{}
	run := &PlaybookRun{ID: mm_model.NewId()}

	channelName, err := svc.ResolveRunCreationParams(run, nil, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "", channelName)
}

func TestResolveRunCreationParams_PlaybookIDMismatch(t *testing.T) {
	svc := &PlaybookRunServiceImpl{licenseChecker: &stubLicenseCheckerNoAttributes{}}

	run := &PlaybookRun{PlaybookID: "pb_a"}
	pb := &Playbook{ID: "pb_b"}

	_, err := svc.ResolveRunCreationParams(run, pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
}

func TestResolveRunCreationParams_SetsPlaybookIDFromPlaybook(t *testing.T) {
	pbID := mm_model.NewId()

	svc := &PlaybookRunServiceImpl{
		licenseChecker:  &stubLicenseCheckerNoAttributes{},
		playbookService: &stubPBServiceRunNumber{nextNum: 1},
	}

	run := &PlaybookRun{PlaybookID: ""}
	pb := &Playbook{ID: pbID, ChannelNameTemplate: "", RunNumberPrefix: ""}

	_, err := svc.ResolveRunCreationParams(run, pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, pbID, run.PlaybookID)
}

func TestResolveRunCreationParams_AllocatesRunNumber(t *testing.T) {
	pbID := mm_model.NewId()

	svc := &PlaybookRunServiceImpl{
		licenseChecker:  &stubLicenseCheckerNoAttributes{},
		playbookService: &stubPBServiceRunNumber{nextNum: 42},
	}

	run := &PlaybookRun{PlaybookID: pbID}
	pb := &Playbook{ID: pbID, ChannelNameTemplate: "", RunNumberPrefix: "INC"}

	_, err := svc.ResolveRunCreationParams(run, pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, int64(42), run.RunNumber)
	assert.Equal(t, "INC-00042", run.SequentialID)
}

func TestResolveRunCreationParams_IncrementRunNumberError(t *testing.T) {
	pbID := mm_model.NewId()

	svc := &PlaybookRunServiceImpl{
		licenseChecker:  &stubLicenseCheckerNoAttributes{},
		playbookService: &stubPBServiceRunNumber{err: errors.New("db unavailable")},
	}

	run := &PlaybookRun{PlaybookID: pbID}
	pb := &Playbook{ID: pbID, ChannelNameTemplate: "", RunNumberPrefix: "INC"}

	_, err := svc.ResolveRunCreationParams(run, pb, nil, RunSourcePost)

	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to allocate run number")
}
