// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewChannelOnlyResolveRunCreationParams tests the NewChannelOnly enforcement inside
// ResolveRunCreationParams. The check fires early — before any store or license calls —
// so we can call the real method on a nearly-zero PlaybookRunServiceImpl.
//
// Three cases are specified by the feature requirement:
//  1. NewChannelOnly=true + ChannelID != "" → rejected (ErrMalformedPlaybookRun)
//  2. NewChannelOnly=false + ChannelID != "" → allowed (proceeds past the guard)
//  3. NewChannelOnly=true + ChannelID == "" → allowed (new channel path)
func TestNewChannelOnlyResolveRunCreationParams(t *testing.T) {
	// newSvc returns a PlaybookRunServiceImpl with only the fields that
	// ResolveRunCreationParams accesses before (and including) the NewChannelOnly guard.
	// Fields that are only reached after the guard is passed are intentionally left nil;
	// the tests below only exercise the early-exit path.
	newSvc := func() *PlaybookRunServiceImpl {
		return &PlaybookRunServiceImpl{}
	}

	t.Run("NewChannelOnly true with existing ChannelID returns ErrMalformedPlaybookRun", func(t *testing.T) {
		pb := &Playbook{
			ID:             "pb-new-channel-only",
			NewChannelOnly: true,
		}
		playbookRun := &PlaybookRun{
			ID:        "run-1",
			ChannelID: "existing-channel-id",
		}

		_, err := newSvc().ResolveRunCreationParams(playbookRun, pb, nil, RunSourceDialog)

		require.Error(t, err, "expected an error when NewChannelOnly=true and ChannelID is set")
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun),
			"expected ErrMalformedPlaybookRun; got: %v", err)
	})

	t.Run("NewChannelOnly false with existing ChannelID does not trigger guard", func(t *testing.T) {
		pb := &Playbook{
			ID:             "pb-no-restriction",
			NewChannelOnly: false,
		}
		playbookRun := &PlaybookRun{
			ID:        "run-2",
			ChannelID: "existing-channel-id",
		}

		// With NewChannelOnly=false the guard is skipped.
		// ResolveRunCreationParams proceeds to the template/license block; since no
		// template is set and licenseChecker is nil the method will panic or error
		// downstream — but the NewChannelOnly guard itself must NOT fire.
		// We distinguish the two outcomes: ErrMalformedPlaybookRun means the guard
		// fired (test failure); any other panic/error means the guard correctly passed.
		defer func() {
			// A nil-pointer panic from the license checker means we got past the guard,
			// which is the correct behaviour for this test.
			_ = recover()
		}()

		_, err := newSvc().ResolveRunCreationParams(playbookRun, pb, nil, RunSourceDialog)

		// If err is ErrMalformedPlaybookRun the NewChannelOnly guard incorrectly fired.
		if err != nil {
			assert.False(t, errors.Is(err, ErrMalformedPlaybookRun),
				"NewChannelOnly=false must NOT return ErrMalformedPlaybookRun from the NewChannelOnly guard; got: %v", err)
		}
	})

	t.Run("NewChannelOnly true with empty ChannelID does not trigger guard", func(t *testing.T) {
		pb := &Playbook{
			ID:             "pb-new-channel-only",
			NewChannelOnly: true,
		}
		playbookRun := &PlaybookRun{
			ID:        "run-3",
			ChannelID: "", // empty — new channel creation
		}

		defer func() {
			// Nil-pointer panic means we got past the guard, which is correct.
			_ = recover()
		}()

		_, err := newSvc().ResolveRunCreationParams(playbookRun, pb, nil, RunSourceDialog)

		if err != nil {
			assert.False(t, errors.Is(err, ErrMalformedPlaybookRun),
				"NewChannelOnly=true + empty ChannelID must NOT return ErrMalformedPlaybookRun from the NewChannelOnly guard; got: %v", err)
		}
	})

	t.Run("nil playbook returns empty string and nil error", func(t *testing.T) {
		playbookRun := &PlaybookRun{
			ID:        "run-nil-pb",
			ChannelID: "any-channel",
		}

		name, err := newSvc().ResolveRunCreationParams(playbookRun, nil, nil, RunSourceDialog)

		require.NoError(t, err)
		assert.Equal(t, "", name, "nil playbook must return empty string")
	})
}

// TestValidateNewChannelOnlyMode tests the package-level helper that guards playbook
// save-time validation. Complementary to the run-creation enforcement tests above.
func TestValidateNewChannelOnlyMode(t *testing.T) {
	t.Run("NewChannelOnly true with link-existing-channel mode returns error", func(t *testing.T) {
		err := ValidateNewChannelOnlyMode(true, PlaybookRunLinkExistingChannel)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "NewChannelOnly")
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
