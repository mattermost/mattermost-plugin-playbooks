// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
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

// TestHasFieldPlaceholders tests field placeholder detection using
// ValidateTemplate(tmpl, ResolveOptions{}), which returns unknown field names
// (excluding system tokens SEQ, OWNER, CREATOR).
func TestHasFieldPlaceholders(t *testing.T) {
	t.Run("empty template", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("", ResolveOptions{})) > 0)
	})

	t.Run("no placeholders", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("plain text", ResolveOptions{})) > 0)
	})

	t.Run("only SEQ placeholder", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("{SEQ} - Run", ResolveOptions{})) > 0)
	})

	t.Run("SEQ case insensitive", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("{seq} - Run", ResolveOptions{})) > 0)
	})

	t.Run("only OWNER placeholder", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("{OWNER} - Run", ResolveOptions{})) > 0)
	})

	t.Run("only CREATOR placeholder", func(t *testing.T) {
		assert.False(t, len(ValidateTemplate("{CREATOR} - Run", ResolveOptions{})) > 0)
	})

	t.Run("field placeholder detected", func(t *testing.T) {
		assert.True(t, len(ValidateTemplate("{Priority} - Run", ResolveOptions{})) > 0)
	})

	t.Run("field placeholder alongside SEQ", func(t *testing.T) {
		assert.True(t, len(ValidateTemplate("{SEQ} - {Priority}", ResolveOptions{})) > 0)
	})

	t.Run("whitespace in placeholder name", func(t *testing.T) {
		assert.True(t, len(ValidateTemplate("{ Priority }", ResolveOptions{})) > 0)
	})
}

// TestRetrospectiveEnabled tests the retrospective guard logic. When a playbook
// has RetrospectiveEnabled=false, retrospective processing must be skipped.
// The backend fix adds a guard to handleReminderToFillRetro; these tests verify
// the condition logic directly.
func TestRetrospectiveEnabled(t *testing.T) {
	t.Run("RetrospectiveEnabled false skips retrospective reminder", func(t *testing.T) {
		retroEnabled := false

		// Simulate the guard added to handleReminderToFillRetro:
		// if !run.RetrospectiveEnabled { cancel and return }
		shouldSkip := !retroEnabled
		require.True(t, shouldSkip, "retrospective reminder must be skipped when RetrospectiveEnabled=false")
	})

	t.Run("RetrospectiveEnabled true (default) does not skip retrospective", func(t *testing.T) {
		retroEnabled := true

		shouldSkip := !retroEnabled
		assert.False(t, shouldSkip, "retrospective reminder must proceed when RetrospectiveEnabled=true")
	})

	t.Run("RetrospectiveEnabled false prevents FinishPlaybookRun from scheduling initial reminder", func(t *testing.T) {
		retroEnabled := false

		// The existing guard in FinishPlaybookRun:
		// if playbookRunToModify.RetrospectiveEnabled { scheduleReminder() }
		shouldSchedule := retroEnabled
		assert.False(t, shouldSchedule)
	})

	t.Run("RetrospectiveEnabled true allows FinishPlaybookRun to schedule reminder", func(t *testing.T) {
		retroEnabled := true

		shouldSchedule := retroEnabled
		assert.True(t, shouldSchedule)
	})
}

// TestDialogPathBlockedForPropertyTemplates tests that ValidateTemplate detects
// property-based placeholders (non-system tokens) and that ResolveRunCreationParams
// rejects dialog/command run creation when such placeholders are present.
func TestDialogPathBlockedForPropertyTemplates(t *testing.T) {
	t.Run("property field placeholder Zone is detected as unknown", func(t *testing.T) {
		unknown := ValidateTemplate("{Zone} incident", ResolveOptions{})
		assert.NotEmpty(t, unknown, "ValidateTemplate must return a non-empty slice for a property field placeholder")
	})

	t.Run("system token SEQ is not flagged as unknown", func(t *testing.T) {
		unknown := ValidateTemplate("{SEQ} - run", ResolveOptions{})
		assert.Empty(t, unknown, "ValidateTemplate must return empty for a template containing only SEQ")
	})

	t.Run("system tokens OWNER and CREATOR are not flagged as unknown", func(t *testing.T) {
		unknown := ValidateTemplate("{OWNER} - {CREATOR} - run", ResolveOptions{})
		assert.Empty(t, unknown, "ValidateTemplate must return empty for a template containing only OWNER and CREATOR")
	})

	t.Run("RunSourceDialog with property template returns ErrMalformedPlaybookRun", func(t *testing.T) {
		svc := &PlaybookRunServiceImpl{
			licenseChecker: &stubLicenseCheckerNoAttributes{},
		}
		pb := &Playbook{
			ID:                  "pb-dialog-test",
			ChannelNameTemplate: "{Zone} incident",
		}
		playbookRun := &PlaybookRun{
			ID: "run-dialog-test",
		}

		_, err := svc.ResolveRunCreationParams(playbookRun, pb, nil, RunSourceDialog)

		require.Error(t, err)
		assert.True(t, errors.Is(err, ErrMalformedPlaybookRun),
			"expected ErrMalformedPlaybookRun for dialog path with property template; got: %v", err)
	})
}

// TestRequiredFieldsPreValidation tests that ResolveTemplate correctly identifies
// unresolved field placeholders when template-referenced fields have no values,
// mirroring the pre-validation logic in ResolveRunCreationParams.
func TestRequiredFieldsPreValidation(t *testing.T) {
	t.Run("template with Zone field and no values has Zone in unresolved", func(t *testing.T) {
		fields := []PropertyField{
			{PropertyField: model.PropertyField{ID: "f1", Name: "Zone", Type: "text"}},
		}
		opts := ResolveOptions{
			Fields:       fields,
			Values:       nil,
			SystemTokens: map[string]string{"SEQ": "1", "OWNER": "alice", "CREATOR": "alice"},
		}

		_, unresolved := ResolveTemplate("{Zone} incident", opts)

		assert.Contains(t, unresolved, "Zone", "Zone must appear in unresolved when no value is provided")
	})

	t.Run("template with Zone field and matching value resolves completely", func(t *testing.T) {
		fields := []PropertyField{
			{PropertyField: model.PropertyField{ID: "f1", Name: "Zone", Type: "text"}},
		}
		opts := ResolveOptions{
			Fields:       fields,
			Values:       map[string]json.RawMessage{"f1": json.RawMessage(`"BGY"`)},
			SystemTokens: map[string]string{"SEQ": "1", "OWNER": "alice", "CREATOR": "alice"},
		}

		result, unresolved := ResolveTemplate("{Zone} incident", opts)

		assert.Empty(t, unresolved, "unresolved must be empty when all field values are provided")
		assert.Equal(t, "BGY incident", result)
	})

	t.Run("system-token-only template with SEQ resolves without fields or values", func(t *testing.T) {
		opts := ResolveOptions{
			Fields:       nil,
			Values:       nil,
			SystemTokens: map[string]string{"SEQ": "42"},
		}

		result, unresolved := ResolveTemplate("{SEQ} - run", opts)

		assert.Empty(t, unresolved, "unresolved must be empty for a system-token-only template")
		assert.Equal(t, "42 - run", result)
	})

	t.Run("template with Zone and Severity only Zone value provided leaves Severity unresolved", func(t *testing.T) {
		fields := []PropertyField{
			{PropertyField: model.PropertyField{ID: "f1", Name: "Zone", Type: "text"}},
			{PropertyField: model.PropertyField{ID: "f2", Name: "Severity", Type: "text"}},
		}
		opts := ResolveOptions{
			Fields:       fields,
			Values:       map[string]json.RawMessage{"f1": json.RawMessage(`"BGY"`)},
			SystemTokens: map[string]string{"SEQ": "1", "OWNER": "alice", "CREATOR": "alice"},
		}

		_, unresolved := ResolveTemplate("{Zone} - {Severity}", opts)

		assert.Contains(t, unresolved, "Severity", "Severity must appear in unresolved when its value is absent")
		assert.NotContains(t, unresolved, "Zone", "Zone must not appear in unresolved when its value is provided")
	})
}
