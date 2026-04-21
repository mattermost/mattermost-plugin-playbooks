// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

// NormalizeAssigneeTypes resets any unrecognised AssigneeType values to "" (unassigned)
// and returns an error if companion ID fields have malformed values.
// This is called at API layer boundaries before persisting playbook checklists.
func NormalizeAssigneeTypes(checklists []Checklist) error {
	for ci := range checklists {
		for ii := range checklists[ci].Items {
			item := &checklists[ci].Items[ii]
			if !IsValidAssigneeType(item.AssigneeType) {
				item.AssigneeType = ""
			}
			// Validate companion ID fields; reject non-empty IDs that fail format validation.
			// Empty IDs are allowed (type set but no specific target selected yet).
			if item.AssigneeType == AssigneeTypeGroup && item.AssigneeGroupID != "" && !model.IsValidId(item.AssigneeGroupID) {
				return errors.Wrapf(ErrMalformedPlaybookRun, "checklist %d item %d: assignee_group_id is not a valid ID", ci, ii)
			}
			if item.AssigneeType == AssigneeTypePropertyUser && item.AssigneePropertyFieldID != "" && !model.IsValidId(item.AssigneePropertyFieldID) {
				return errors.Wrapf(ErrMalformedPlaybookRun, "checklist %d item %d: assignee_property_field_id is not a valid ID", ci, ii)
			}
		}
	}
	return nil
}
