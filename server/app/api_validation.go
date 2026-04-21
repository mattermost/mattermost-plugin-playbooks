// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	MaxRunNameLength    = 1024
	MaxRunSummaryLength = 4096
)

// ValidateOwnerID validates an owner ID for change-owner operations.
func ValidateOwnerID(ownerID string) error {
	if ownerID == "" {
		return errors.Wrap(ErrMalformedPlaybookRun, "owner ID must not be empty")
	}
	if !model.IsValidId(ownerID) {
		return errors.Wrap(ErrMalformedPlaybookRun, "owner ID is not a valid ID")
	}
	return nil
}

// ValidateRunNameUpdate validates and trims a run name for update operations.
// Returns the trimmed name or an error.
func ValidateRunNameUpdate(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", errors.Wrap(ErrMalformedPlaybookRun, "run name must not be empty")
	}
	if utf8.RuneCountInString(trimmed) > MaxRunNameLength {
		return "", errors.Wrapf(ErrMalformedPlaybookRun, "run name must be at most %d characters", MaxRunNameLength)
	}
	return trimmed, nil
}

// ValidateRunSummaryUpdate validates and trims a run summary for update operations.
// Returns the trimmed summary or an error. An empty or whitespace-only input is valid
// (callers use it to clear the summary) and returns ("", nil).
func ValidateRunSummaryUpdate(summary string) (string, error) {
	trimmed := strings.TrimSpace(summary)
	if utf8.RuneCountInString(trimmed) > MaxRunSummaryLength {
		return "", errors.Wrapf(ErrMalformedPlaybookRun, "run summary must be at most %d characters", MaxRunSummaryLength)
	}
	return trimmed, nil
}

// ValidateRunUpdateOnFinished checks that name/summary updates are not applied to finished runs.
// Note: ChannelID, BroadcastChannelIDs, and WebhookOnStatusUpdateURLs are intentionally
// updatable on finished runs — they configure delivery settings, not run content.
func ValidateRunUpdateOnFinished(currentStatus string, hasNameUpdate, hasSummaryUpdate bool) error {
	if currentStatus == StatusFinished && (hasNameUpdate || hasSummaryUpdate) {
		return errors.Wrap(ErrPlaybookRunNotActive, "cannot update a finished run")
	}
	return nil
}

// GovernanceFlagChanges describes which governance flags the caller is attempting to change.
type GovernanceFlagChanges struct {
	EnableAdminOnlyEdit         bool // false→true transition
	DisableAdminOnlyEdit        bool // true→false transition
	ToggleOwnerGroupOnlyActions bool // change in either direction
	ToggleNewChannelOnly        bool // change in either direction
	ToggleAutoArchiveChannel    bool // change in either direction
}

// ValidateGovernanceFlags checks whether the calling user has the required role to
// toggle governance flags (AdminOnlyEdit, OwnerGroupOnlyActions, NewChannelOnly, AutoArchiveChannel).
func ValidateGovernanceFlags(isSystemAdmin, isPlaybookAdmin bool, changes GovernanceFlagChanges) error {
	if isSystemAdmin || isPlaybookAdmin {
		return nil
	}
	if changes.EnableAdminOnlyEdit || changes.DisableAdminOnlyEdit {
		return errors.Wrap(ErrNoPermissions, "only playbook admins or system admins can change admin-only edit")
	}
	if changes.ToggleOwnerGroupOnlyActions {
		return errors.Wrap(ErrNoPermissions, "only playbook admins or system admins can toggle owner-group-only actions")
	}
	if changes.ToggleNewChannelOnly {
		return errors.Wrap(ErrNoPermissions, "only playbook admins or system admins can toggle new-channel-only")
	}
	if changes.ToggleAutoArchiveChannel {
		return errors.Wrap(ErrNoPermissions, "only playbook admins or system admins can toggle auto-archive channel")
	}
	return nil
}


// ValidateTemplateAfterFieldDeletion checks whether channelNameTemplate still
// references deletedFieldID after it has been removed. Returns an error if it does.
func ValidateTemplateAfterFieldDeletion(channelNameTemplate, deletedFieldID string, allFields []PropertyField) error {
	if channelNameTemplate == "" {
		return nil
	}
	cap := len(allFields) - 1
	if cap < 0 {
		cap = 0
	}
	remaining := make([]PropertyField, 0, cap)
	for _, f := range allFields {
		if f.ID != deletedFieldID {
			remaining = append(remaining, f)
		}
	}
	if unknown := ValidateTemplate(channelNameTemplate, ResolveOptions{Fields: remaining}); len(unknown) > 0 {
		return errors.Wrap(ErrMalformedPlaybookRun, "cannot delete property field: it is referenced by the channel name template")
	}
	return nil
}

// UnknownTemplateFieldsError returns the standard error message for unknown field references in a channel name template.
func UnknownTemplateFieldsError(unknown []string) string {
	return fmt.Sprintf("channel name template references unknown field(s): %s", strings.Join(unknown, ", "))
}

// ValidateChannelNameTemplateWithPrefix checks that if the template uses {SEQ}, a non-empty prefix is configured.
func ValidateChannelNameTemplateWithPrefix(template, prefix string) error {
	if TemplateUsesSeqToken(template) && strings.TrimSpace(prefix) == "" {
		return errors.Wrap(ErrMalformedPlaybookRun, "channel name template uses {SEQ} but no run number prefix is configured")
	}
	return nil
}
