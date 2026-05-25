// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeAndValidateRunCreationParams(t *testing.T) {
	t.Run("nil playbookRun is rejected", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(nil, &Playbook{ID: "pb-A"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be nil")
	})

	t.Run("nil playbook is allowed", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(&PlaybookRun{}, nil)
		require.NoError(t, err)
	})

	t.Run("PlaybookID mismatch between run and supplied playbook is rejected", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(
			&PlaybookRun{PlaybookID: "pb-A"},
			&Playbook{ID: "pb-B"},
		)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun),
			"expected ErrMalformedPlaybookRun; got: %v", err)
		assert.Contains(t, err.Error(), "mismatch")
	})

	t.Run("matching PlaybookID is not rejected", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(
			&PlaybookRun{PlaybookID: "pb-A"},
			&Playbook{ID: "pb-A"},
		)
		require.NoError(t, err)
	})

	t.Run("empty PlaybookID is filled from pb.ID", func(t *testing.T) {
		run := &PlaybookRun{PlaybookID: ""}
		err := normalizeAndValidateRunCreationParams(run, &Playbook{ID: "pb-A"})
		require.NoError(t, err)
		assert.Equal(t, "pb-A", run.PlaybookID, "PlaybookID must be set from pb.ID when empty")
	})

	t.Run("non-empty PlaybookID is not overwritten", func(t *testing.T) {
		run := &PlaybookRun{PlaybookID: "pb-A"}
		err := normalizeAndValidateRunCreationParams(run, &Playbook{ID: "pb-A"})
		require.NoError(t, err)
		assert.Equal(t, "pb-A", run.PlaybookID)
	})

	t.Run("NewChannelOnly true with existing ChannelID is rejected", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(
			&PlaybookRun{ChannelID: "existing-channel"},
			&Playbook{ID: "pb-A", NewChannelOnly: true},
		)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun),
			"expected ErrMalformedPlaybookRun; got: %v", err)
	})

	t.Run("NewChannelOnly true with empty ChannelID is allowed", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(
			&PlaybookRun{ChannelID: ""},
			&Playbook{ID: "pb-A", NewChannelOnly: true},
		)
		require.NoError(t, err)
	})

	t.Run("NewChannelOnly false with existing ChannelID is allowed", func(t *testing.T) {
		err := normalizeAndValidateRunCreationParams(
			&PlaybookRun{ChannelID: "existing-channel"},
			&Playbook{ID: "pb-A", NewChannelOnly: false},
		)
		require.NoError(t, err)
	})
}

func TestValidateNewChannelOnlyMode(t *testing.T) {
	t.Run("NewChannelOnly true with link-existing-channel mode returns error", func(t *testing.T) {
		err := ValidateNewChannelOnlyMode(true, PlaybookRunLinkExistingChannel)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "link an existing channel")
		assert.NotContains(t, err.Error(), "NewChannelOnly", "error must not leak Go field names")
	})

	t.Run("NewChannelOnly false with link-existing-channel mode is valid", func(t *testing.T) {
		err := ValidateNewChannelOnlyMode(false, PlaybookRunLinkExistingChannel)
		require.NoError(t, err)
	})

	t.Run("NewChannelOnly true with create-new-channel mode is valid", func(t *testing.T) {
		err := ValidateNewChannelOnlyMode(true, PlaybookRunCreateNewChannel)
		require.NoError(t, err)
	})

	t.Run("NewChannelOnly false with create-new-channel mode is valid", func(t *testing.T) {
		err := ValidateNewChannelOnlyMode(false, PlaybookRunCreateNewChannel)
		require.NoError(t, err)
	})
}
