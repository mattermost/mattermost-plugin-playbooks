// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// allocPlaybookServiceStub is a PlaybookService stub configurable for resolveAndAllocate tests.
// Only the methods resolveAndAllocate exercises are usable; the rest panic so unexpected calls surface.
type allocPlaybookServiceStub struct {
	getResult            Playbook
	getErr               error
	getCalled            int
	incrementResult      int64
	incrementErr         error
	incrementCalled      int
	updateTemplateCalled int
	updateTemplateResult bool
	updateTemplateErr    error
}

func (s *allocPlaybookServiceStub) Get(string) (Playbook, error) {
	s.getCalled++
	return s.getResult, s.getErr
}
func (s *allocPlaybookServiceStub) IncrementRunNumber(string) (int64, error) {
	s.incrementCalled++
	return s.incrementResult, s.incrementErr
}
func (s *allocPlaybookServiceStub) UpdateChannelNameTemplateIfUnchanged(string, string, string) (bool, error) {
	s.updateTemplateCalled++
	return s.updateTemplateResult, s.updateTemplateErr
}

// Unused-by-resolveAndAllocate methods: panic to make accidental calls visible.
func (s *allocPlaybookServiceStub) Create(Playbook, string) (string, error) { panic("not called") }
func (s *allocPlaybookServiceStub) Import(PlaybookImportData, string) (string, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) GetPlaybookConditionsForExport(string) ([]Condition, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) GetPlaybooks() ([]Playbook, error)       { panic("not called") }
func (s *allocPlaybookServiceStub) GetActivePlaybooks() ([]Playbook, error) { panic("not called") }
func (s *allocPlaybookServiceStub) GetPlaybooksForTeam(RequesterInfo, string, PlaybookFilterOptions) (GetPlaybooksResults, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) Update(Playbook, string) error           { panic("not called") }
func (s *allocPlaybookServiceStub) Archive(Playbook, string) error          { panic("not called") }
func (s *allocPlaybookServiceStub) Restore(Playbook, string) error          { panic("not called") }
func (s *allocPlaybookServiceStub) AutoFollow(string, string) error         { panic("not called") }
func (s *allocPlaybookServiceStub) AutoUnfollow(string, string) error       { panic("not called") }
func (s *allocPlaybookServiceStub) GetAutoFollows(string) ([]string, error) { panic("not called") }
func (s *allocPlaybookServiceStub) Duplicate(Playbook, string) (string, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) GetTopPlaybooksForTeam(string, string, *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) GetTopPlaybooksForUser(string, string, *InsightsOpts) (*PlaybooksInsightsList, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) CreatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) UpdatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) DeletePropertyField(string, string) error { panic("not called") }
func (s *allocPlaybookServiceStub) ReorderPropertyFields(string, string, int) ([]PropertyField, error) {
	panic("not called")
}
func (s *allocPlaybookServiceStub) UpdateChannelNameTemplate(string, string, string) error {
	panic("not called")
}
func (s *allocPlaybookServiceStub) UpdateChannelNameTemplateOverrideAllowed(string, bool, string) error {
	panic("not called")
}
func (s *allocPlaybookServiceStub) UpdateRunNumberPrefix(string, string, string) error {
	panic("not called")
}

// allocPropertyServiceStub is a minimal PropertyService stub: returns fixed fields and
// passes through SanitizePropertyValue unchanged. Methods resolveAndAllocate never calls panic.
type allocPropertyServiceStub struct {
	fields []PropertyField
}

func (s *allocPropertyServiceStub) GetPropertyFields(string) ([]PropertyField, error) {
	return s.fields, nil
}
func (s *allocPropertyServiceStub) SanitizePropertyValue(_ model.PropertyFieldType, raw json.RawMessage) (json.RawMessage, error) {
	return raw, nil
}
func (s *allocPropertyServiceStub) CreatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetPropertyField(string) (*PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetPropertyFieldsSince(string, int64) ([]PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetPropertyFieldsCount(string) (int, error) { panic("not called") }
func (s *allocPropertyServiceStub) GetRunPropertyFields(string) ([]PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunPropertyFieldsSince(string, int64) ([]PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunPropertyValues(string) ([]PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunsPropertyValues([]string) (map[string][]PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunPropertyValuesSince(string, int64) ([]PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunPropertyValueByFieldID(string, string) (*PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) UpdatePropertyField(string, PropertyField) (*PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) DeletePropertyField(string, string) error { panic("not called") }
func (s *allocPropertyServiceStub) ReorderPropertyFields(string, string, int) ([]PropertyField, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) CopyPlaybookPropertiesToRun(string, string) (*PropertyCopyResult, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) CopyPlaybookPropertiesToPlaybook(string, string) (*PropertyCopyResult, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) UpsertRunPropertyValue(string, string, json.RawMessage) (*PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) UpsertRunPropertyValueWithField(string, *PropertyField, json.RawMessage) (*PropertyValue, error) {
	panic("not called")
}
func (s *allocPropertyServiceStub) GetRunsPropertyFields([]string) (map[string][]PropertyField, error) {
	panic("not called")
}

type allocLicenseCheckerWithAttributes struct{}

func (s *allocLicenseCheckerWithAttributes) PlaybookAllowed(bool) bool         { return true }
func (s *allocLicenseCheckerWithAttributes) RetrospectiveAllowed() bool        { return true }
func (s *allocLicenseCheckerWithAttributes) TimelineAllowed() bool             { return true }
func (s *allocLicenseCheckerWithAttributes) StatsAllowed() bool                { return true }
func (s *allocLicenseCheckerWithAttributes) ChecklistItemDueDateAllowed() bool { return true }
func (s *allocLicenseCheckerWithAttributes) PlaybookAttributesAllowed() bool   { return true }
func (s *allocLicenseCheckerWithAttributes) ConditionalPlaybooksAllowed() bool { return true }

// ---------------------------------------------------------------------------
// Tests for resolveAndAllocate
// ---------------------------------------------------------------------------
//
// resolveAndAllocate is the SOLE allocation point for RunNumber and SequentialID.
// These tests pin two atomicity invariants that the rest of the feature depends on:
//   1. The counter is consumed AFTER dry-run validation succeeds (no gap on bad
//      templates, missing required fields, or stale playbook reads).
//   2. The counter is consumed EXACTLY ONCE per successful call (no double-increment
//      on retry-after-validation paths).

func newAllocService(pbStub *allocPlaybookServiceStub) *PlaybookRunServiceImpl {
	return &PlaybookRunServiceImpl{
		playbookService: pbStub,
		propertyService: &allocPropertyServiceStub{},
		licenseChecker:  &stubLicenseCheckerNoAttributes{},
	}
}

func TestResolveAndAllocate_HappyPathPrefixed(t *testing.T) {
	pb := Playbook{ID: "pb_1", RunNumberPrefix: "INC"}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 42}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "anything"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, int64(42), run.RunNumber, "RunNumber must come from IncrementRunNumber")
	assert.Equal(t, "INC-00042", run.SequentialID, "SequentialID must format prefix + zero-padded counter")
	assert.NotEmpty(t, channelName)
	assert.Equal(t, 1, pbStub.incrementCalled, "counter consumed exactly once")
}

func TestResolveAndAllocate_HappyPathNoPrefix(t *testing.T) {
	pb := Playbook{ID: "pb_1", RunNumberPrefix: ""}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "first"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, int64(1), run.RunNumber)
	assert.Equal(t, "00001", run.SequentialID, "no-prefix mode yields a bare zero-padded counter")
}

func TestResolveAndAllocate_ReReadPlaybookFails(t *testing.T) {
	pb := Playbook{ID: "pb_1", RunNumberPrefix: "INC"}
	pbStub := &allocPlaybookServiceStub{getErr: errors.New("db down")}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "test"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to re-read playbook before allocation")
	assert.Equal(t, 0, pbStub.incrementCalled, "no counter consumed when re-read fails")
	assert.Equal(t, int64(0), run.RunNumber, "RunNumber untouched on failure")
}

func TestResolveAndAllocate_IncrementError(t *testing.T) {
	pb := Playbook{ID: "pb_1", RunNumberPrefix: "INC"}
	pbStub := &allocPlaybookServiceStub{
		getResult:    pb,
		incrementErr: errors.New("connection lost"),
	}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "test"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to allocate run number")
	assert.Equal(t, int64(0), run.RunNumber, "RunNumber untouched when increment fails")
	assert.Equal(t, "", run.SequentialID, "SequentialID untouched when increment fails")
}

func TestResolveAndAllocate_IncrementNotFoundWrapsMalformedRun(t *testing.T) {
	pb := Playbook{ID: "pb_1", RunNumberPrefix: "INC"}
	pbStub := &allocPlaybookServiceStub{
		getResult:    pb,
		incrementErr: ErrNotFound,
	}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "test"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrMalformedPlaybookRun), "ErrNotFound from increment must wrap to ErrMalformedPlaybookRun")
}

// TestResolveAndAllocate_DryRunFailureSkipsAllocation pins the atomicity contract:
// when template dry-run validation fails (license-on + template missing a required
// property value), the counter must NOT be consumed.
//
// This test deliberately exercises the licensed path because dry-run only validates
// property-field placeholders when PlaybookAttributesAllowed() is true.
func TestResolveAndAllocate_DryRunFailureSkipsAllocation(t *testing.T) {
	zoneField := PropertyField{
		PropertyField: model.PropertyField{
			ID:   "fld_zone",
			Name: "Zone",
			Type: model.PropertyFieldTypeText,
		},
	}
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "{Zone}",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb}
	svc := &PlaybookRunServiceImpl{
		playbookService: pbStub,
		propertyService: &allocPropertyServiceStub{fields: []PropertyField{zoneField}},
		licenseChecker:  &allocLicenseCheckerWithAttributes{},
	}

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "test"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrMalformedPlaybookRun), "missing required template field must wrap ErrMalformedPlaybookRun")
	assert.True(t, strings.Contains(err.Error(), "Zone") || strings.Contains(err.Error(), "fields with missing"), "error must name the missing field")
	assert.Equal(t, 0, pbStub.incrementCalled, "counter MUST NOT be consumed when dry-run fails (gap-free atomicity)")
	assert.Equal(t, int64(0), run.RunNumber)
	assert.Equal(t, "", run.SequentialID)
}

// ---------------------------------------------------------------------------
// Tests for ChannelNameTemplateOverrideAllowed
// ---------------------------------------------------------------------------
//
// ChannelNameTemplateOverrideAllowed defaults to true (the caller's name wins) and only takes
// effect when the template actually contains a {token} placeholder. A purely literal template
// (no placeholder) always allows override, regardless of the stored flag, since forcing it would
// only ever produce one fixed run name.

func TestResolveAndAllocate_OverrideNotAllowedTemplateWithVariableOverridesUserSuppliedName(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Incident-{SEQ}",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "My Custom Name"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "Incident-INC-00001", run.Name, "override-not-allowed template must override the caller's name")
	assert.Equal(t, "Incident-INC-00001", channelName)
}

func TestResolveAndAllocate_OverrideNotAllowedTemplateWithNoUserSuppliedName(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Incident-{SEQ}",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "Incident-INC-00001", run.Name)
	assert.Equal(t, "Incident-INC-00001", channelName)
}

func TestResolveAndAllocate_OverrideAllowedTemplateUsesUserSuppliedName(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Incident-{SEQ}",
		ChannelNameTemplateOverrideAllowed: true,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "My Custom Name"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "My Custom Name", run.Name, "when override is allowed, the caller's name must win")
	assert.Equal(t, "My Custom Name", channelName, "the channel name must be derived from the caller's name, not the template")
}

// The API layer (server/api/playbook_runs.go) rejects this case before CreatePlaybookRun is
// even called, so this test only pins resolveAndAllocate's own defense-in-depth behavior for
// callers that skip that pre-check. Per the "gaps are acceptable" comment on resolveAndAllocate,
// the run number is already allocated by the time the missing-name check runs.
func TestResolveAndAllocate_OverrideAllowedWithNoUserSuppliedNameFails(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Incident-{SEQ}",
		ChannelNameTemplateOverrideAllowed: true,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
}

// A literal template (no {token} placeholder) always allows override, even if an admin
// explicitly set ChannelNameTemplateOverrideAllowed to false — locking it would just force
// every run to the exact same name, so the flag is a no-op for a template with no variable.
func TestResolveAndAllocate_LiteralTemplateAlwaysAllowsOverride(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Zone Alpha",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "My Custom Name"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "My Custom Name", run.Name, "a template with no variable can never be forced, regardless of the stored flag")
	assert.Equal(t, "My Custom Name", channelName)
}

func TestResolveAndAllocate_LiteralTemplateWithNoUserSuppliedNameFails(t *testing.T) {
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "Zone Alpha",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.Error(t, err, "override is forced-allowed for a literal template, so an explicit name is still required")
	assert.True(t, errors.Is(err, ErrMalformedPlaybookRun))
}

// An unrecognized placeholder (a typo, or a reference to a field that was since deleted) must not
// be able to "lock" a template that can never actually resolve, even when real property fields
// ARE loaded and one happens to exist under a different name.
func TestResolveAndAllocate_UnrecognizedPlaceholderDoesNotTrickOverrideAllowed(t *testing.T) {
	zoneField := PropertyField{
		PropertyField: model.PropertyField{
			ID:   "fld_zone",
			Name: "Zone",
			Type: model.PropertyFieldTypeText,
		},
	}
	pb := Playbook{
		ID:                                 "pb_1",
		RunNumberPrefix:                    "INC",
		ChannelNameTemplate:                "{notARealVariable}",
		ChannelNameTemplateOverrideAllowed: false,
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := &PlaybookRunServiceImpl{
		playbookService: pbStub,
		propertyService: &allocPropertyServiceStub{fields: []PropertyField{zoneField}},
		licenseChecker:  &allocLicenseCheckerWithAttributes{},
	}

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "My Custom Name"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "My Custom Name", run.Name, "an unrecognized placeholder must not be honored as a lock; the caller's name must win")
	assert.Equal(t, "My Custom Name", channelName)
}

// ---------------------------------------------------------------------------
// Tests for token resolution within a user-supplied name
// ---------------------------------------------------------------------------
//
// A user-supplied name is resolved the same way a template is: recognized tokens
// (system tokens or real property fields) are substituted. Unlike a locked template,
// an unresolved token is left as literal text rather than rejected.

func TestResolveAndAllocate_UserSuppliedNameResolvesSystemToken(t *testing.T) {
	pb := Playbook{
		ID:              "pb_1",
		RunNumberPrefix: "INC",
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "Release {SEQ} kickoff"}
	channelName, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "Release INC-00001 kickoff", run.Name)
	assert.Equal(t, "Release INC-00001 kickoff", channelName)
}

func TestResolveAndAllocate_UserSuppliedNameResolvesPropertyField(t *testing.T) {
	versionField := PropertyField{
		PropertyField: model.PropertyField{
			ID:   "fld_version",
			Name: "Version",
			Type: model.PropertyFieldTypeText,
		},
	}
	pb := Playbook{
		ID:              "pb_1",
		RunNumberPrefix: "INC",
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := &PlaybookRunServiceImpl{
		playbookService: pbStub,
		propertyService: &allocPropertyServiceStub{fields: []PropertyField{versionField}},
		licenseChecker:  &allocLicenseCheckerWithAttributes{},
	}

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "Release version {Version}"}
	initialValues := map[string]json.RawMessage{
		"fld_version": json.RawMessage(`"2.10"`),
	}
	channelName, err := svc.resolveAndAllocate(run, &pb, initialValues, RunSourcePost)

	require.NoError(t, err)
	assert.Equal(t, "Release version 2.10", run.Name)
	assert.Equal(t, "Release version 2.10", channelName)
}

func TestResolveAndAllocate_UserSuppliedNameLeavesUnrecognizedTokenLiteral(t *testing.T) {
	pb := Playbook{
		ID:              "pb_1",
		RunNumberPrefix: "INC",
	}
	pbStub := &allocPlaybookServiceStub{getResult: pb, incrementResult: 1}
	svc := newAllocService(pbStub)

	run := &PlaybookRun{PlaybookID: pb.ID, Name: "Sprint {notARealVariable}"}
	_, err := svc.resolveAndAllocate(run, &pb, nil, RunSourcePost)

	require.NoError(t, err, "an unresolved token in a user-supplied name must not block run creation")
	assert.Equal(t, "Sprint {notARealVariable}", run.Name, "an unrecognized token is left literal, not stripped or rejected")
}
