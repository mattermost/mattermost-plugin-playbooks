// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

// validateID checks that an ID matches the Mattermost ID format.
func validateID(id, name string) error {
	if id == "" {
		return fmt.Errorf("%s is required", name)
	}
	if !model.IsValidId(id) {
		return fmt.Errorf("%s must be a valid Mattermost ID", name)
	}
	return nil
}

// validateIndex checks that an index is non-negative.
func validateIndex(val int, name string) error {
	if val < 0 {
		return fmt.Errorf("%s must be a non-negative integer, got %d", name, val)
	}
	return nil
}
