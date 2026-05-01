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
