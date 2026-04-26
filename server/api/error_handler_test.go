// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"
	"testing"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestFindSentinelError(t *testing.T) {
	tests := []struct {
		name          string
		err           error
		wantNil       bool
		wantStatus    int
		wantPublicMsg string
	}{
		{
			name:          "ErrNotFound",
			err:           app.ErrNotFound,
			wantStatus:    http.StatusNotFound,
			wantPublicMsg: "Not found.",
		},
		{
			name:          "ErrNoPermissions",
			err:           app.ErrNoPermissions,
			wantStatus:    http.StatusForbidden,
			wantPublicMsg: "You don't have permission to perform this action.",
		},
		{
			name:          "ErrDuplicateEntry",
			err:           app.ErrDuplicateEntry,
			wantStatus:    http.StatusConflict,
			wantPublicMsg: "A resource with this identifier already exists.",
		},
		{
			name:          "ErrMalformedPlaybookRun",
			err:           app.ErrMalformedPlaybookRun,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Invalid playbook run data.",
		},
		{
			name:          "ErrPlaybookArchived",
			err:           app.ErrPlaybookArchived,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Playbook is archived and cannot be modified.",
		},
		{
			name:          "ErrChannelDisplayNameInvalid",
			err:           app.ErrChannelDisplayNameInvalid,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Invalid channel display name.",
		},
		{
			name:          "ErrPropertyFieldNotOnRun",
			err:           app.ErrPropertyFieldNotOnRun,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Property field does not belong to this run.",
		},
		{
			name:          "ErrPropertyFieldInUse",
			err:           app.ErrPropertyFieldInUse,
			wantStatus:    http.StatusConflict,
			wantPublicMsg: "Property field is in use and cannot be deleted.",
		},
		{
			name:          "ErrPropertyOptionsInUse",
			err:           app.ErrPropertyOptionsInUse,
			wantStatus:    http.StatusConflict,
			wantPublicMsg: "Property options are in use and cannot be deleted.",
		},
		{
			name:          "ErrPropertyFieldTypeChangeNotAllowed",
			err:           app.ErrPropertyFieldTypeChangeNotAllowed,
			wantStatus:    http.StatusConflict,
			wantPublicMsg: "Property field type cannot be changed.",
		},
		{
			name:          "ErrReservedPropertyFieldName",
			err:           app.ErrReservedPropertyFieldName,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "This property field name is reserved.",
		},
		{
			name:          "ErrPlaybookRunNotActive",
			err:           app.ErrPlaybookRunNotActive,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Playbook run has already ended.",
		},
		{
			name:          "ErrPlaybookRunActive",
			err:           app.ErrPlaybookRunActive,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Playbook run is already active.",
		},
		{
			name:          "ErrLicensedFeature",
			err:           app.ErrLicensedFeature,
			wantStatus:    http.StatusForbidden,
			wantPublicMsg: "This feature is not available with your current license.",
		},
		{
			name:          "ErrMalformedCondition",
			err:           app.ErrMalformedCondition,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Invalid condition data.",
		},
		{
			name:          "ErrFilterTooWide",
			err:           app.ErrFilterTooWide,
			wantStatus:    http.StatusBadRequest,
			wantPublicMsg: "Filter matches too many results; please narrow the filter.",
		},
		{
			name:          "ErrPropertyLimitExceeded",
			err:           app.ErrPropertyLimitExceeded,
			wantStatus:    http.StatusConflict,
			wantPublicMsg: "Maximum number of property fields reached.",
		},
		{
			name:          "ErrInternalPrecondition",
			err:           app.ErrInternalPrecondition,
			wantStatus:    http.StatusInternalServerError,
			wantPublicMsg: "An internal server error occurred.",
		},
		{
			name:          "wrapped sentinel still matches",
			err:           errors.Wrap(app.ErrNoPermissions, "user not allowed to do thing"),
			wantStatus:    http.StatusForbidden,
			wantPublicMsg: "You don't have permission to perform this action.",
		},
		{
			name:    "unknown error returns nil",
			err:     errors.New("some random error"),
			wantNil: true,
		},
		{
			name:    "nil error returns nil",
			err:     nil,
			wantNil: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := findSentinelError(tc.err)
			if tc.wantNil {
				require.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			require.Equal(t, tc.wantStatus, got.status)
			require.Equal(t, tc.wantPublicMsg, got.publicMsg)
		})
	}
}

// TestSentinelErrorsTableCoverage guards against drift between the sentinel
// table and the test cases above. Every entry in sentinelErrors must have a
// corresponding case in TestFindSentinelError so that adding a new sentinel
// without a test fails CI.
func TestSentinelErrorsTableCoverage(t *testing.T) {
	// Number of positive test cases in TestFindSentinelError that exercise
	// a distinct sentinel from the table.
	const expectedSentinels = 18
	require.Len(t, sentinelErrors, expectedSentinels,
		"sentinelErrors table changed; update TestFindSentinelError to cover the new entry and bump expectedSentinels")
}
