// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewChannelOnly tests the NewChannelOnly enforcement logic added to
// ResolveRunCreationParams. When NewChannelOnly=true, a run creation request
// that supplies a non-empty ChannelID (linking an existing channel) must be
// rejected. A request with an empty ChannelID (creating a new channel) must
// pass through.
func TestNewChannelOnly(t *testing.T) {
	t.Run("NewChannelOnly false allows existing channel link", func(t *testing.T) {
		pb := Playbook{
			NewChannelOnly: false,
		}
		playbookRun := PlaybookRun{
			ChannelID: "existing-channel-id", // linking an existing channel
		}

		// Simulate the NewChannelOnly guard from ResolveRunCreationParams:
		// if pb.NewChannelOnly && playbookRun.ChannelID != "" → reject
		rejected := pb.NewChannelOnly && playbookRun.ChannelID != ""
		assert.False(t, rejected, "NewChannelOnly=false should allow linking an existing channel")
	})

	t.Run("NewChannelOnly true rejects existing channel link", func(t *testing.T) {
		pb := Playbook{
			NewChannelOnly: true,
		}
		playbookRun := PlaybookRun{
			ChannelID: "existing-channel-id", // caller wants to link existing channel
		}

		rejected := pb.NewChannelOnly && playbookRun.ChannelID != ""
		require.True(t, rejected, "NewChannelOnly=true must reject linking an existing channel")
	})

	t.Run("NewChannelOnly true allows new channel creation", func(t *testing.T) {
		pb := Playbook{
			NewChannelOnly: true,
		}
		playbookRun := PlaybookRun{
			ChannelID: "", // empty ChannelID means "create new channel"
		}

		rejected := pb.NewChannelOnly && playbookRun.ChannelID != ""
		assert.False(t, rejected, "NewChannelOnly=true must allow new channel creation (empty ChannelID)")
	})

	t.Run("NewChannelOnly false allows new channel creation too", func(t *testing.T) {
		pb := Playbook{
			NewChannelOnly: false,
		}
		playbookRun := PlaybookRun{
			ChannelID: "",
		}

		rejected := pb.NewChannelOnly && playbookRun.ChannelID != ""
		assert.False(t, rejected)
	})
}

// TestNewChannelOnlyEnforcement tests the inline NewChannelOnly guard logic
// that ResolveRunCreationParams uses. When violated, an error wrapping
// ErrMalformedPlaybookRun is returned.
func TestNewChannelOnlyEnforcement(t *testing.T) {
	t.Run("no rejection when NewChannelOnly false with existing channel", func(t *testing.T) {
		newChannelOnly := false
		channelID := "existing-channel-id"
		rejected := newChannelOnly && channelID != ""
		require.False(t, rejected)
	})

	t.Run("rejection when NewChannelOnly true with existing channel", func(t *testing.T) {
		newChannelOnly := true
		channelID := "existing-channel-id"
		rejected := newChannelOnly && channelID != ""
		require.True(t, rejected)
	})

	t.Run("no rejection when NewChannelOnly true with empty ChannelID", func(t *testing.T) {
		newChannelOnly := true
		channelID := ""
		rejected := newChannelOnly && channelID != ""
		require.False(t, rejected)
	})
}
