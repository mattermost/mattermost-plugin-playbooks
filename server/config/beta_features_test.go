// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsTaskRequirementsEnabled(t *testing.T) {
	t.Run("disabled by default", func(t *testing.T) {
		svc := &ServiceImpl{configuration: &Configuration{}}
		assert.False(t, svc.IsTaskRequirementsEnabled())
	})

	t.Run("enabled when task_requirements is true", func(t *testing.T) {
		svc := &ServiceImpl{
			configuration: &Configuration{
				BetaFeatures: BetaFeaturesConfig{TaskRequirements: true},
			},
		}
		assert.True(t, svc.IsTaskRequirementsEnabled())
	})
}

func TestSerializeIncludesBetaFeatures(t *testing.T) {
	cfg := &Configuration{
		BetaFeatures: BetaFeaturesConfig{TaskRequirements: true},
	}
	serialized := cfg.serialize()

	raw, ok := serialized["BetaFeatures"]
	require.True(t, ok, "serialize() must include BetaFeatures key matching plugin.json")

	beta, ok := raw.(map[string]any)
	require.True(t, ok, "BetaFeatures must serialize as map[string]any for plugin RPC/gob")
	assert.Equal(t, true, beta["task_requirements"])
}
