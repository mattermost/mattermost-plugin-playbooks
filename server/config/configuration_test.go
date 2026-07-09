// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSerializeKeysMatchPluginManifest guards against the casing mismatch that
// caused MM-69465. The System Console persists a setting under its plugin.json
// settings_schema key, while serialize() writes the plugin's own copy. If the two
// disagree (even only in case), they become distinct keys that LoadPluginConfiguration
// collapses non-deterministically. This test fails if serialize() can produce a
// duplicate, either on its own or relative to the manifest.
func TestSerializeKeysMatchPluginManifest(t *testing.T) {
	serialized := (&Configuration{}).serialize()

	t.Run("serialize() keys never collide case-insensitively", func(t *testing.T) {
		seen := make(map[string]string, len(serialized))
		for key := range serialized {
			lower := strings.ToLower(key)
			assert.NotContainsf(t, seen, lower,
				"serialize() emits %q which collapses to the same config key as %q", key, seen[lower])
			seen[lower] = key
		}
	})

	t.Run("every plugin.json settings_schema key is written verbatim by serialize()", func(t *testing.T) {
		data, err := os.ReadFile(filepath.Join("..", "..", "plugin.json"))
		require.NoError(t, err)

		var manifest struct {
			SettingsSchema struct {
				Settings []struct {
					Key string `json:"key"`
				} `json:"settings"`
			} `json:"settings_schema"`
		}
		require.NoError(t, json.Unmarshal(data, &manifest))
		require.NotEmpty(t, manifest.SettingsSchema.Settings, "plugin.json should declare settings")

		for _, setting := range manifest.SettingsSchema.Settings {
			_, ok := serialized[setting.Key]
			assert.Truef(t, ok,
				"plugin.json settings_schema key %q is not written verbatim by serialize(); "+
					"the console writes under that key, so a differently cased serialize() key would create a duplicate",
				setting.Key)
		}
	})
}
