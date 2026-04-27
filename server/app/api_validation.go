// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
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
