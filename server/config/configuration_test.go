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
// caused MM-69465. The System Console persists a setting under a key derived from
// its plugin.json settings_schema key, while serialize() writes the plugin's own
// copy. If the two disagree (even only in case), they become distinct keys that
// LoadPluginConfiguration collapses non-deterministically. This test fails if
// serialize() can produce a duplicate, either on its own or relative to the
// manifest.
//
// The console saves every setting under its lowercased key. serialize() writes
// BetaFeatures that way; the other settings still use their plugin.json key.
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

	// lowercased lists the settings serialize() writes under the lowercased key
	// the console saves, rather than the plugin.json key.
	lowercased := map[string]bool{"BetaFeatures": true}

	t.Run("every plugin.json settings_schema key is written by serialize()", func(t *testing.T) {
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
			key := setting.Key
			if lowercased[key] {
				key = strings.ToLower(key)
			}
			_, ok := serialized[key]
			assert.Truef(t, ok,
				"serialize() does not write plugin.json settings_schema key %q as %q; "+
					"the console writes under that key, so a differently cased serialize() key would create a duplicate",
				setting.Key, key)
		}
	})
}
