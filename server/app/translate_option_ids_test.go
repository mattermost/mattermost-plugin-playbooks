// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTranslateOptionIDs(t *testing.T) {
	t.Run("option ID found in mapping returns translated value", func(t *testing.T) {
		optionMappings := map[string]string{
			"old-option-id": "new-option-id",
		}
		raw := json.RawMessage(`"old-option-id"`)

		result, err := translateOptionIDs(raw, optionMappings)

		require.NoError(t, err)
		var got string
		require.NoError(t, json.Unmarshal(result, &got))
		require.Equal(t, "new-option-id", got)
	})

	t.Run("option ID NOT in mapping returns original value unchanged", func(t *testing.T) {
		optionMappings := map[string]string{
			"old-option-id": "new-option-id",
		}
		// A user ID that is not a select option — should pass through unchanged, not return nil.
		userID := "abcdefghijklmnopqrstuvwxyz"
		raw := json.RawMessage(`"` + userID + `"`)

		result, err := translateOptionIDs(raw, optionMappings)

		require.NoError(t, err)
		require.NotNil(t, result)
		var got string
		require.NoError(t, json.Unmarshal(result, &got))
		require.Equal(t, userID, got)
	})

	t.Run("empty optionMappings always returns original value unchanged", func(t *testing.T) {
		optionMappings := map[string]string{}
		raw := json.RawMessage(`"some-value"`)

		result, err := translateOptionIDs(raw, optionMappings)

		require.NoError(t, err)
		require.NotNil(t, result)
		var got string
		require.NoError(t, json.Unmarshal(result, &got))
		require.Equal(t, "some-value", got)
	})

	t.Run("multi-value JSON array with some IDs in mapping and some not", func(t *testing.T) {
		optionMappings := map[string]string{
			"old-id-1": "new-id-1",
			"old-id-2": "new-id-2",
		}
		// old-id-1 and old-id-2 are mapped; unknown-id is not in the mapping and is skipped.
		raw := json.RawMessage(`["old-id-1", "unknown-id", "old-id-2"]`)

		result, err := translateOptionIDs(raw, optionMappings)

		require.NoError(t, err)
		require.NotNil(t, result)
		var got []string
		require.NoError(t, json.Unmarshal(result, &got))
		require.Equal(t, []string{"new-id-1", "new-id-2"}, got)
	})
}
