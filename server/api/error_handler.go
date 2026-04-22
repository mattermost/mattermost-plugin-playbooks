// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"net/http"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// sentinelError pairs an app-layer sentinel error with the HTTP status code and the
// safe public message to send to clients. Order matters: more-specific sentinels must
// appear before more-general ones so the first match wins during iteration.
type sentinelError struct {
	sentinel  error
	status    int
	publicMsg string
}

// sentinelErrors is the single source of truth for mapping app-layer errors to HTTP
// responses. A slice (not a map) is used so that iteration order is deterministic —
// map iteration in Go is randomized, which would cause non-deterministic status codes
// if an error chain ever matched multiple sentinels.
//
// Note: RunFinish, RunRestore, and RunChangeOwner permission-check failures bypass
// this table intentionally — they return 403 for ErrNotFound/ErrNoPermissions (to avoid
// leaking run existence) and 500 for infrastructure errors.
var sentinelErrors = []sentinelError{
	{app.ErrNotFound, http.StatusNotFound, "Not found."},
	{app.ErrNoPermissions, http.StatusForbidden, "You don't have permission to perform this action."},
	{app.ErrDuplicateEntry, http.StatusConflict, "A resource with this identifier already exists."},
	{app.ErrMalformedPlaybookRun, http.StatusBadRequest, "Invalid playbook run data."},
	{app.ErrPlaybookArchived, http.StatusBadRequest, "Playbook is archived and cannot be modified."},
	{app.ErrChannelDisplayNameInvalid, http.StatusBadRequest, "Invalid channel display name."},
	{app.ErrPropertyFieldInUse, http.StatusConflict, "Property field is in use and cannot be deleted."},
	{app.ErrPropertyOptionsInUse, http.StatusConflict, "Property options are in use and cannot be deleted."},
	{app.ErrPropertyFieldTypeChangeNotAllowed, http.StatusConflict, "Property field type cannot be changed."},
	{app.ErrPlaybookRunNotActive, http.StatusBadRequest, "Playbook run has already ended."},
	{app.ErrPlaybookRunActive, http.StatusBadRequest, "Playbook run is already active."},
	{app.ErrLicensedFeature, http.StatusForbidden, "This feature is not available with your current license."},
	{app.ErrMalformedCondition, http.StatusBadRequest, "Invalid condition data."},
}

type ErrorHandler struct {
}

// HandleError logs the internal error and sends a JSON error response. If the error
// matches a known sentinel (e.g. ErrNoPermissions → 403), the corresponding status and
// public message are used; otherwise a generic 500 is returned.
func (h *ErrorHandler) HandleError(w http.ResponseWriter, logger logrus.FieldLogger, internalErr error) {
	if se := findSentinelError(internalErr); se != nil {
		h.HandleErrorWithCode(w, logger, se.status, se.publicMsg, internalErr)
		return
	}
	h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "An internal error has occurred. Check app server logs for details.", internalErr)
}

// HandleErrorWithCode logs the internal error and sends the public facing error
// message as JSON in a response with the provided code.
func (h *ErrorHandler) HandleErrorWithCode(w http.ResponseWriter, logger logrus.FieldLogger, code int, publicErrorMsg string, internalErr error) {
	HandleErrorWithCode(logger, w, code, publicErrorMsg, internalErr)
}

// findSentinelError returns the first sentinelError in the table whose sentinel
// is in err's error chain, or nil if none match.
func findSentinelError(err error) *sentinelError {
	for i := range sentinelErrors {
		if errors.Is(err, sentinelErrors[i].sentinel) {
			return &sentinelErrors[i]
		}
	}
	return nil
}

// PermissionsCheck handles the output of a permission check
// Automatically does the proper error handling.
// Returns true if the check passed and false on failure. Correct use is: if !h.PermissionsCheck(w, check) { return }
func (h *ErrorHandler) PermissionsCheck(w http.ResponseWriter, logger logrus.FieldLogger, checkOutput error) bool {
	if checkOutput != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "Not authorized", checkOutput)
		return false
	}

	return true
}

// checkPlaybookAttributesLicense writes a 403 and returns false when the
// PlaybookAttributes feature is not covered by the current server license.
func checkPlaybookAttributesLicense(licenseChecker app.LicenseChecker, w http.ResponseWriter, logger logrus.FieldLogger) bool {
	if licenseChecker.PlaybookAttributesAllowed() {
		return true
	}
	HandleErrorWithCode(logger, w, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
	return false
}
