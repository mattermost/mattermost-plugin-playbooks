// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOwnerID(t *testing.T) {
	t.Run("valid ID is accepted", func(t *testing.T) {
		err := ValidateOwnerID(model.NewId())
		require.NoError(t, err)
	})

	t.Run("empty string returns error", func(t *testing.T) {
		err := ValidateOwnerID("")
		require.Error(t, err)
	})

	t.Run("malformed ID returns error", func(t *testing.T) {
		err := ValidateOwnerID("not-a-valid-id")
		require.Error(t, err)
	})
}

func TestValidateRunNameUpdate(t *testing.T) {
	t.Run("valid name is returned trimmed", func(t *testing.T) {
		result, err := ValidateRunNameUpdate("  My Run  ")
		require.NoError(t, err)
		assert.Equal(t, "My Run", result)
	})

	t.Run("empty string returns error", func(t *testing.T) {
		_, err := ValidateRunNameUpdate("")
		require.Error(t, err)
	})

	t.Run("whitespace-only string returns error", func(t *testing.T) {
		_, err := ValidateRunNameUpdate("   ")
		require.Error(t, err)
	})

	t.Run("name at exactly MaxRunNameLength is accepted", func(t *testing.T) {
		name := strings.Repeat("a", MaxRunNameLength)
		result, err := ValidateRunNameUpdate(name)
		require.NoError(t, err)
		assert.Equal(t, name, result)
	})

	t.Run("name exceeding MaxRunNameLength returns error", func(t *testing.T) {
		name := strings.Repeat("a", MaxRunNameLength+1)
		_, err := ValidateRunNameUpdate(name)
		require.Error(t, err)
	})
}

func TestValidateRunSummaryUpdate(t *testing.T) {
	t.Run("valid summary is returned trimmed", func(t *testing.T) {
		result, err := ValidateRunSummaryUpdate("  summary  ")
		require.NoError(t, err)
		assert.Equal(t, "summary", result)
	})

	t.Run("empty string is valid and returns empty string", func(t *testing.T) {
		result, err := ValidateRunSummaryUpdate("")
		require.NoError(t, err)
		assert.Equal(t, "", result)
	})

	t.Run("whitespace-only string is valid and returns empty string", func(t *testing.T) {
		result, err := ValidateRunSummaryUpdate("   ")
		require.NoError(t, err)
		assert.Equal(t, "", result)
	})

	t.Run("summary at exactly MaxRunSummaryLength is accepted", func(t *testing.T) {
		summary := strings.Repeat("a", MaxRunSummaryLength)
		result, err := ValidateRunSummaryUpdate(summary)
		require.NoError(t, err)
		assert.Equal(t, summary, result)
	})

	t.Run("summary exceeding MaxRunSummaryLength returns error", func(t *testing.T) {
		summary := strings.Repeat("a", MaxRunSummaryLength+1)
		_, err := ValidateRunSummaryUpdate(summary)
		require.Error(t, err)
	})
}

func TestValidateRunUpdateOnFinished(t *testing.T) {
	t.Run("finished run with name update returns error", func(t *testing.T) {
		err := ValidateRunUpdateOnFinished(StatusFinished, true, false)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrPlaybookRunNotActive))
	})

	t.Run("finished run with summary update returns error", func(t *testing.T) {
		err := ValidateRunUpdateOnFinished(StatusFinished, false, true)
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrPlaybookRunNotActive))
	})

	t.Run("finished run with no name/summary update is allowed", func(t *testing.T) {
		err := ValidateRunUpdateOnFinished(StatusFinished, false, false)
		require.NoError(t, err)
	})

	t.Run("active run with name update is allowed", func(t *testing.T) {
		err := ValidateRunUpdateOnFinished(StatusInProgress, true, false)
		require.NoError(t, err)
	})

	t.Run("active run with summary update is allowed", func(t *testing.T) {
		err := ValidateRunUpdateOnFinished(StatusInProgress, false, true)
		require.NoError(t, err)
	})
}

func TestValidateChannelNameTemplateWithPrefix(t *testing.T) {
	t.Run("template without SEQ token and empty prefix is valid", func(t *testing.T) {
		err := ValidateChannelNameTemplateWithPrefix("incident-{NAME}", "")
		require.NoError(t, err)
	})

	t.Run("template with SEQ token and non-empty prefix is valid", func(t *testing.T) {
		err := ValidateChannelNameTemplateWithPrefix("{SEQ}-{NAME}", "INC")
		require.NoError(t, err)
	})

	t.Run("template with SEQ token and empty prefix returns error", func(t *testing.T) {
		err := ValidateChannelNameTemplateWithPrefix("{SEQ}-{NAME}", "")
		require.Error(t, err)
	})

	t.Run("template with SEQ token and whitespace-only prefix returns error", func(t *testing.T) {
		err := ValidateChannelNameTemplateWithPrefix("{SEQ}-{NAME}", "   ")
		require.Error(t, err)
	})

	t.Run("template without SEQ token and non-empty prefix is valid", func(t *testing.T) {
		err := ValidateChannelNameTemplateWithPrefix("{NAME}", "INC")
		require.NoError(t, err)
	})
}

func TestValidateGovernanceFlags(t *testing.T) {
	t.Run("system admin enabling AdminOnlyEdit is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, false, GovernanceFlagChanges{EnableAdminOnlyEdit: true})
		require.NoError(t, err)
	})

	t.Run("playbook admin enabling AdminOnlyEdit is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, true, GovernanceFlagChanges{EnableAdminOnlyEdit: true})
		require.NoError(t, err)
	})

	t.Run("regular user enabling AdminOnlyEdit returns ErrNoPermissions", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{EnableAdminOnlyEdit: true})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})

	t.Run("system admin toggling OwnerGroupOnlyActions is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, false, GovernanceFlagChanges{ToggleOwnerGroupOnlyActions: true})
		require.NoError(t, err)
	})

	t.Run("playbook admin toggling OwnerGroupOnlyActions is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, true, GovernanceFlagChanges{ToggleOwnerGroupOnlyActions: true})
		require.NoError(t, err)
	})

	t.Run("regular user toggling OwnerGroupOnlyActions returns ErrNoPermissions", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{ToggleOwnerGroupOnlyActions: true})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})

	t.Run("regular user disabling AdminOnlyEdit (false) is allowed", func(t *testing.T) {
		// enableAdminOnlyEdit=false means caller is not transitioning false→true,
		// so no elevated privilege is required.
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{})
		require.NoError(t, err)
	})

	t.Run("system admin enabling both flags is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, false, GovernanceFlagChanges{EnableAdminOnlyEdit: true, ToggleOwnerGroupOnlyActions: true})
		require.NoError(t, err)
	})

	t.Run("regular user enabling both flags returns ErrNoPermissions", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{EnableAdminOnlyEdit: true, ToggleOwnerGroupOnlyActions: true})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})

	t.Run("both system admin and playbook admin enabling AdminOnlyEdit is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, true, GovernanceFlagChanges{EnableAdminOnlyEdit: true})
		require.NoError(t, err)
	})

	t.Run("system admin enabling NewChannelOnly is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, false, GovernanceFlagChanges{ToggleNewChannelOnly: true})
		require.NoError(t, err)
	})

	t.Run("playbook admin enabling NewChannelOnly is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, true, GovernanceFlagChanges{ToggleNewChannelOnly: true})
		require.NoError(t, err)
	})

	t.Run("regular user enabling NewChannelOnly returns ErrNoPermissions", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{ToggleNewChannelOnly: true})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})

	t.Run("system admin enabling AutoArchiveChannel is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(true, false, GovernanceFlagChanges{ToggleAutoArchiveChannel: true})
		require.NoError(t, err)
	})

	t.Run("playbook admin enabling AutoArchiveChannel is allowed", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, true, GovernanceFlagChanges{ToggleAutoArchiveChannel: true})
		require.NoError(t, err)
	})

	t.Run("regular user enabling AutoArchiveChannel returns ErrNoPermissions", func(t *testing.T) {
		err := ValidateGovernanceFlags(false, false, GovernanceFlagChanges{ToggleAutoArchiveChannel: true})
		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrNoPermissions),
			"expected ErrNoPermissions; got: %v", err)
	})
}
