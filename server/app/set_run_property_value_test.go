// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// stubRunStore embeds PlaybookRunStore so only the method exercised here needs
// an implementation; any other call would nil-panic and surface immediately.
type stubRunStore struct {
	PlaybookRunStore
	run *PlaybookRun
	err error
}

func (s *stubRunStore) GetPlaybookRun(string) (*PlaybookRun, error) {
	return s.run, s.err
}

// stubLicenseChecker reports that premium run attributes are disabled, so
// GetPlaybookRun leaves PropertyFields empty and the stubbed run controls the test.
type stubLicenseChecker struct {
	LicenseChecker
}

func (stubLicenseChecker) PlaybookAttributesAllowed() bool { return false }

// TestSetRunPropertyValue_FieldOwnershipValidation covers the guard in
// SetRunPropertyValue: when the supplied field is not one of the run's fields,
// it must return ErrPropertyFieldNotOnRun instead of dereferencing a nil field
// (which previously panicked the plugin for a cross-run field ID).
func TestSetRunPropertyValue_FieldOwnershipValidation(t *testing.T) {
	runID := model.NewId()

	newService := func(run *PlaybookRun, storeErr error) *PlaybookRunServiceImpl {
		return &PlaybookRunServiceImpl{
			store:          &stubRunStore{run: run, err: storeErr},
			licenseChecker: stubLicenseChecker{},
		}
	}

	t.Run("field not on run is rejected without panicking", func(t *testing.T) {
		svc := newService(&PlaybookRun{ID: runID}, nil)

		_, err := svc.SetRunPropertyValue("user1", runID, model.NewId(), json.RawMessage(`"high"`))

		require.Error(t, err)
		require.Contains(t, err.Error(), "does not belong to run")
	})

	t.Run("store error on lookup propagates", func(t *testing.T) {
		svc := newService(nil, errors.New("db unavailable"))

		_, err := svc.SetRunPropertyValue("user1", runID, model.NewId(), json.RawMessage(`"high"`))

		require.Error(t, err)
	})
}
