// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/pkg/errors"
)

const (
	MaxRunNameLength = 1024
)

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
