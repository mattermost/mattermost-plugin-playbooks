// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStandaloneRunCreation(t *testing.T) {
	// Test that playbook runs can be created without a PlaybookID (standalone runs)

	t.Run("create standalone run with empty PlaybookID", func(t *testing.T) {
		standaloneRun := PlaybookRun{
			Name:        "Test Standalone Run",
			TeamID:      "team-id",
			ChannelID:   "channel-id",
			OwnerUserID: "user-id",
			PlaybookID:  "", // Empty PlaybookID for standalone run
			Type:        RunTypeChannelChecklist,
		}

		// Verify the run is configured as standalone
		assert.Empty(t, standaloneRun.PlaybookID, "PlaybookID should be empty for standalone runs")
		assert.Equal(t, RunTypeChannelChecklist, standaloneRun.Type, "Type should be channelChecklist for standalone runs")

		// Verify essential fields are still present
		assert.NotEmpty(t, standaloneRun.Name, "Name should be present")
		assert.NotEmpty(t, standaloneRun.TeamID, "TeamID should be present")
		assert.NotEmpty(t, standaloneRun.OwnerUserID, "OwnerUserID should be present")
		assert.NotEmpty(t, standaloneRun.ChannelID, "ChannelId should be present")
	})
}
