// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEvaluateCreationRules(t *testing.T) {
	zoneFieldID := "field-zone"
	priorityFieldID := "field-priority"

	criticalOptionID := "option-critical"
	normalOptionID := "option-normal"
	zoneAlphaOptionID := "option-zone-alpha"
	zoneBetaOptionID := "option-zone-beta"

	securityOwnerID := "user-security-owner"
	generalOwnerID := "user-general-owner"
	securityChannelID := "channel-security"
	invitedUser1 := "user-invite-1"
	invitedUser2 := "user-invite-2"

	makeSelectValue := func(optionID string) json.RawMessage {
		b, _ := json.Marshal(optionID)
		return b
	}

	t.Run("matching rule sets owner", func(t *testing.T) {
		// Rule: if zone == "Zone Alpha" → set owner to security owner
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		run := PlaybookRun{
			ID:          "run-1",
			OwnerUserID: generalOwnerID,
			PropertyValues: []PropertyValue{
				{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityOwnerID, run.OwnerUserID, "matching rule must set OwnerUserID")
	})

	t.Run("no matching rule keeps defaults", func(t *testing.T) {
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		// Run has zone=Beta, rule requires zone=Alpha → no match
		run := PlaybookRun{
			ID:          "run-2",
			OwnerUserID: generalOwnerID,
			PropertyValues: []PropertyValue{
				{FieldID: zoneFieldID, Value: makeSelectValue(zoneBetaOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, generalOwnerID, run.OwnerUserID, "no match must preserve default owner")
	})

	t.Run("first matching rule wins", func(t *testing.T) {
		// Two rules both match zone=Alpha; first rule sets securityOwnerID,
		// second rule sets a different owner. Only first should apply.
		secondOwnerID := "user-second-owner"
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: securityOwnerID, // first matching rule
			},
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: secondOwnerID, // second matching rule — must be ignored
			},
		}

		run := PlaybookRun{
			ID:          "run-3",
			OwnerUserID: generalOwnerID,
			PropertyValues: []PropertyValue{
				{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityOwnerID, run.OwnerUserID,
			"first matching rule must win; second matching rule must be ignored")
	})

	t.Run("rule with SetChannelID overrides channel", func(t *testing.T) {
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: priorityFieldID,
						Value:   json.RawMessage(`["` + criticalOptionID + `"]`),
					},
				},
				SetChannelID: securityChannelID,
			},
		}

		run := PlaybookRun{
			ID:        "run-4",
			ChannelID: "",
			PropertyValues: []PropertyValue{
				{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityChannelID, run.ChannelID, "matching rule must set ChannelID")
	})

	t.Run("rule with InviteUserIDs adds participants", func(t *testing.T) {
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: priorityFieldID,
						Value:   json.RawMessage(`["` + criticalOptionID + `"]`),
					},
				},
				InviteUserIDs: []string{invitedUser1, invitedUser2},
			},
		}

		run := PlaybookRun{
			ID:             "run-5",
			InvitedUserIDs: []string{},
			PropertyValues: []PropertyValue{
				{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		require.Contains(t, run.InvitedUserIDs, invitedUser1, "invited user 1 must be added")
		require.Contains(t, run.InvitedUserIDs, invitedUser2, "invited user 2 must be added")
	})

	t.Run("empty rules array is no-op", func(t *testing.T) {
		rules := []CreationRule{}

		run := PlaybookRun{
			ID:          "run-6",
			OwnerUserID: generalOwnerID,
			ChannelID:   "original-channel",
			PropertyValues: []PropertyValue{
				{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, generalOwnerID, run.OwnerUserID, "no rules — owner unchanged")
		assert.Equal(t, "original-channel", run.ChannelID, "no rules — channel unchanged")
	})

	t.Run("rule with multiple actions applies all actions", func(t *testing.T) {
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: priorityFieldID,
						Value:   json.RawMessage(`["` + criticalOptionID + `"]`),
					},
				},
				SetOwnerID:    securityOwnerID,
				SetChannelID:  securityChannelID,
				InviteUserIDs: []string{invitedUser1},
			},
		}

		run := PlaybookRun{
			ID:             "run-7",
			OwnerUserID:    generalOwnerID,
			ChannelID:      "",
			InvitedUserIDs: []string{},
			PropertyValues: []PropertyValue{
				{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityOwnerID, run.OwnerUserID)
		assert.Equal(t, securityChannelID, run.ChannelID)
		assert.Contains(t, run.InvitedUserIDs, invitedUser1)
	})

	t.Run("rule with nil condition matches everything", func(t *testing.T) {
		// A rule with no condition is a catch-all — it always matches.
		// This allows a default-owner rule as a fallback at the end of the list.
		rules := []CreationRule{
			{
				Condition:  nil, // no condition — always matches
				SetOwnerID: securityOwnerID,
			},
		}

		run := PlaybookRun{
			ID:          "run-8",
			OwnerUserID: generalOwnerID,
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityOwnerID, run.OwnerUserID)
	})

	t.Run("non-critical priority rule does not match critical priority run", func(t *testing.T) {
		// Verifies that a rule with a non-matching value is correctly rejected.
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: priorityFieldID,
						Value:   json.RawMessage(`["` + normalOptionID + `"]`),
					},
				},
				SetOwnerID: generalOwnerID,
			},
		}

		run := PlaybookRun{
			ID:          "run-9",
			OwnerUserID: securityOwnerID,
			PropertyValues: []PropertyValue{
				{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, securityOwnerID, run.OwnerUserID,
			"rule for 'normal' must not match a 'critical' run")
	})

	t.Run("and condition requires all sub-conditions to match", func(t *testing.T) {
		// Rule: zone=Alpha AND priority=critical → set owner
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					And: []ConditionExprV1{
						{Is: &ComparisonCondition{
							FieldID: zoneFieldID,
							Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
						}},
						{Is: &ComparisonCondition{
							FieldID: priorityFieldID,
							Value:   json.RawMessage(`["` + criticalOptionID + `"]`),
						}},
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		t.Run("both conditions match - rule applies", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-and-1",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
					{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "both conditions match: rule must apply")
		})

		t.Run("only one condition matches - rule does not apply", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-and-2",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
					{FieldID: priorityFieldID, Value: makeSelectValue(normalOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, generalOwnerID, run.OwnerUserID, "only one condition matches: rule must not apply")
		})
	})

	t.Run("or condition matches when any sub-condition matches", func(t *testing.T) {
		// Rule: zone=Alpha OR zone=Beta → set owner
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Or: []ConditionExprV1{
						{Is: &ComparisonCondition{
							FieldID: zoneFieldID,
							Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
						}},
						{Is: &ComparisonCondition{
							FieldID: zoneFieldID,
							Value:   json.RawMessage(`["` + zoneBetaOptionID + `"]`),
						}},
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		t.Run("first option matches - rule applies", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-or-1",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "zone=Alpha matches OR condition")
		})

		t.Run("second option matches - rule applies", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-or-2",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneBetaOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "zone=Beta matches OR condition")
		})

		t.Run("neither option matches - rule does not apply", func(t *testing.T) {
			otherOptionID := "option-zone-gamma"
			run := PlaybookRun{
				ID:          "run-or-3",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(otherOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, generalOwnerID, run.OwnerUserID, "neither option matches: rule must not apply")
		})
	})

	t.Run("isNot condition matches when value is not in list", func(t *testing.T) {
		// Rule: zone IsNot Alpha → set owner
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					IsNot: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		t.Run("value is beta - isNot alpha matches", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-isnot-1",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneBetaOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "zone=Beta satisfies IsNot Alpha")
		})

		t.Run("value is alpha - isNot alpha does not match", func(t *testing.T) {
			run := PlaybookRun{
				ID:          "run-isnot-2",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, generalOwnerID, run.OwnerUserID, "zone=Alpha does not satisfy IsNot Alpha")
		})
	})

	t.Run("text field condition matches case-insensitively", func(t *testing.T) {
		textFieldID := "field-text"

		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: textFieldID,
						Value:   json.RawMessage(`"CRITICAL"`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		t.Run("lowercase value matches uppercase condition", func(t *testing.T) {
			textValue, _ := json.Marshal("critical")
			run := PlaybookRun{
				ID:          "run-text-1",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: textFieldID, Value: textValue},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "case-insensitive text match must apply rule")
		})

		t.Run("different value does not match", func(t *testing.T) {
			textValue, _ := json.Marshal("normal")
			run := PlaybookRun{
				ID:          "run-text-2",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: textFieldID, Value: textValue},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, generalOwnerID, run.OwnerUserID, "non-matching text value must not apply rule")
		})
	})

	t.Run("multiselect condition matches when any value is in condition array", func(t *testing.T) {
		multiFieldID := "field-multi"

		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: multiFieldID,
						Value:   json.RawMessage(`["opt-b"]`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		t.Run("multiselect contains matching option - rule applies", func(t *testing.T) {
			multiValue, _ := json.Marshal([]string{"opt-a", "opt-b"})
			run := PlaybookRun{
				ID:          "run-multi-1",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: multiFieldID, Value: multiValue},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, securityOwnerID, run.OwnerUserID, "multiselect with opt-b must match condition [opt-b]")
		})

		t.Run("multiselect does not contain matching option - rule does not apply", func(t *testing.T) {
			multiValue, _ := json.Marshal([]string{"opt-a", "opt-c"})
			run := PlaybookRun{
				ID:          "run-multi-2",
				OwnerUserID: generalOwnerID,
				PropertyValues: []PropertyValue{
					{FieldID: multiFieldID, Value: multiValue},
				},
			}

			evaluateCreationRules(rules, &run)
			assert.Equal(t, generalOwnerID, run.OwnerUserID, "multiselect without opt-b must not match condition [opt-b]")
		})
	})

	t.Run("invite user ids are deduplicated across rules", func(t *testing.T) {
		// Rule 1 and Rule 2 both invite invitedUser1; rule 2 also invites invitedUser2.
		// invitedUser1 should appear only once.
		rules := []CreationRule{
			{
				Condition:     nil, // catch-all
				InviteUserIDs: []string{invitedUser1},
			},
			{
				Condition:     nil, // catch-all
				InviteUserIDs: []string{invitedUser1, invitedUser2},
			},
		}

		run := PlaybookRun{
			ID:             "run-dedup-1",
			OwnerUserID:    generalOwnerID,
			InvitedUserIDs: []string{},
		}

		evaluateCreationRules(rules, &run)
		assert.Contains(t, run.InvitedUserIDs, invitedUser1, "invitedUser1 must be present")
		assert.Contains(t, run.InvitedUserIDs, invitedUser2, "invitedUser2 must be present")

		count := 0
		for _, uid := range run.InvitedUserIDs {
			if uid == invitedUser1 {
				count++
			}
		}
		assert.Equal(t, 1, count, "invitedUser1 must appear exactly once after deduplication")
	})

	t.Run("existing invited users are preserved when rule adds more", func(t *testing.T) {
		existingUser := "user-existing"
		newUser := "user-new"

		rules := []CreationRule{
			{
				Condition:     nil, // catch-all
				InviteUserIDs: []string{newUser},
			},
		}

		run := PlaybookRun{
			ID:             "run-preserve-1",
			OwnerUserID:    generalOwnerID,
			InvitedUserIDs: []string{existingUser},
		}

		evaluateCreationRules(rules, &run)
		assert.Contains(t, run.InvitedUserIDs, existingUser, "existing user must be preserved")
		assert.Contains(t, run.InvitedUserIDs, newUser, "new user from rule must be added")
	})

	t.Run("condition on missing property field does not match", func(t *testing.T) {
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				SetOwnerID: securityOwnerID,
			},
		}

		// Run has no PropertyValues at all
		run := PlaybookRun{
			ID:             "run-missing-1",
			OwnerUserID:    generalOwnerID,
			PropertyValues: []PropertyValue{},
		}

		evaluateCreationRules(rules, &run)
		assert.Equal(t, generalOwnerID, run.OwnerUserID, "missing field must not satisfy the condition")
	})

	t.Run("invite user ids accumulate across multiple matching rules", func(t *testing.T) {
		// Rule 1 matches: invites invitedUser1; Rule 2 matches: invites invitedUser2.
		// Both users must be in InvitedUserIDs.
		rules := []CreationRule{
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: priorityFieldID,
						Value:   json.RawMessage(`["` + criticalOptionID + `"]`),
					},
				},
				InviteUserIDs: []string{invitedUser1},
			},
			{
				Condition: &ConditionExprV1{
					Is: &ComparisonCondition{
						FieldID: zoneFieldID,
						Value:   json.RawMessage(`["` + zoneAlphaOptionID + `"]`),
					},
				},
				InviteUserIDs: []string{invitedUser2},
			},
		}

		run := PlaybookRun{
			ID:             "run-accum-1",
			OwnerUserID:    generalOwnerID,
			InvitedUserIDs: []string{},
			PropertyValues: []PropertyValue{
				{FieldID: priorityFieldID, Value: makeSelectValue(criticalOptionID)},
				{FieldID: zoneFieldID, Value: makeSelectValue(zoneAlphaOptionID)},
			},
		}

		evaluateCreationRules(rules, &run)
		assert.Contains(t, run.InvitedUserIDs, invitedUser1, "invitedUser1 from rule 1 must be present")
		assert.Contains(t, run.InvitedUserIDs, invitedUser2, "invitedUser2 from rule 2 must be present")
	})
}

// TestMatchesCreationCondition tests the matchesCreationCondition helper directly,
// covering all branch paths in the function.
func TestMatchesCreationCondition(t *testing.T) {
	fieldID := "field-zone"
	optAlpha := "opt-alpha"
	optBeta := "opt-beta"

	makeValueMap := func(fieldID, optionID string) map[string]PropertyValue {
		b, _ := json.Marshal(optionID)
		return map[string]PropertyValue{
			fieldID: {FieldID: fieldID, Value: b},
		}
	}

	t.Run("nil condition always matches", func(t *testing.T) {
		assert.True(t, matchesCreationCondition(nil, map[string]PropertyValue{}))
	})

	t.Run("empty condition with no sub-conditions matches", func(t *testing.T) {
		cond := &ConditionExprV1{}
		assert.True(t, matchesCreationCondition(cond, map[string]PropertyValue{}))
	})

	t.Run("is condition matches when value is present", func(t *testing.T) {
		cond := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optAlpha + `"]`),
			},
		}
		assert.True(t, matchesCreationCondition(cond, makeValueMap(fieldID, optAlpha)))
	})

	t.Run("is condition does not match when value is absent", func(t *testing.T) {
		cond := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optAlpha + `"]`),
			},
		}
		assert.False(t, matchesCreationCondition(cond, makeValueMap(fieldID, optBeta)))
	})

	t.Run("isNot condition matches when value is not in list", func(t *testing.T) {
		cond := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optAlpha + `"]`),
			},
		}
		assert.True(t, matchesCreationCondition(cond, makeValueMap(fieldID, optBeta)))
	})

	t.Run("isNot condition does not match when value is in list", func(t *testing.T) {
		cond := &ConditionExprV1{
			IsNot: &ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optAlpha + `"]`),
			},
		}
		assert.False(t, matchesCreationCondition(cond, makeValueMap(fieldID, optAlpha)))
	})

	t.Run("and condition returns true only when all sub-conditions match", func(t *testing.T) {
		fieldID2 := "field-priority"
		optCritical := "opt-critical"

		cond := &ConditionExprV1{
			And: []ConditionExprV1{
				{Is: &ComparisonCondition{FieldID: fieldID, Value: json.RawMessage(`["` + optAlpha + `"]`)}},
				{Is: &ComparisonCondition{FieldID: fieldID2, Value: json.RawMessage(`["` + optCritical + `"]`)}},
			},
		}

		b1, _ := json.Marshal(optAlpha)
		b2, _ := json.Marshal(optCritical)
		bothMatch := map[string]PropertyValue{
			fieldID:  {FieldID: fieldID, Value: b1},
			fieldID2: {FieldID: fieldID2, Value: b2},
		}
		assert.True(t, matchesCreationCondition(cond, bothMatch))

		b3, _ := json.Marshal(optBeta)
		onlyFirst := map[string]PropertyValue{
			fieldID:  {FieldID: fieldID, Value: b1},
			fieldID2: {FieldID: fieldID2, Value: b3},
		}
		assert.False(t, matchesCreationCondition(cond, onlyFirst))
	})

	t.Run("or condition returns true when any sub-condition matches", func(t *testing.T) {
		cond := &ConditionExprV1{
			Or: []ConditionExprV1{
				{Is: &ComparisonCondition{FieldID: fieldID, Value: json.RawMessage(`["` + optAlpha + `"]`)}},
				{Is: &ComparisonCondition{FieldID: fieldID, Value: json.RawMessage(`["` + optBeta + `"]`)}},
			},
		}

		assert.True(t, matchesCreationCondition(cond, makeValueMap(fieldID, optAlpha)))
		assert.True(t, matchesCreationCondition(cond, makeValueMap(fieldID, optBeta)))

		b, _ := json.Marshal("opt-gamma")
		neither := map[string]PropertyValue{fieldID: {FieldID: fieldID, Value: b}}
		assert.False(t, matchesCreationCondition(cond, neither))
	})

	t.Run("is condition on missing field returns false", func(t *testing.T) {
		cond := &ConditionExprV1{
			Is: &ComparisonCondition{
				FieldID: "nonexistent-field",
				Value:   json.RawMessage(`["` + optAlpha + `"]`),
			},
		}
		assert.False(t, matchesCreationCondition(cond, makeValueMap(fieldID, optAlpha)))
	})
}

func TestValidateCreationRules(t *testing.T) {
	validID := "abcdefghijklmnopqrstuvwxyz" // 26 lowercase chars — valid MM ID format

	t.Run("empty rules passes", func(t *testing.T) {
		require.NoError(t, ValidateCreationRules(nil))
		require.NoError(t, ValidateCreationRules([]CreationRule{}))
	})

	t.Run("valid IDs pass", func(t *testing.T) {
		rules := []CreationRule{
			{SetOwnerID: validID, SetChannelID: validID, InviteUserIDs: []string{validID}},
		}
		require.NoError(t, ValidateCreationRules(rules))
	})

	t.Run("empty optional fields pass", func(t *testing.T) {
		rules := []CreationRule{{}}
		require.NoError(t, ValidateCreationRules(rules))
	})

	t.Run("invalid SetOwnerID rejected", func(t *testing.T) {
		rules := []CreationRule{{SetOwnerID: "not-a-valid-id"}}
		require.Error(t, ValidateCreationRules(rules))
	})

	t.Run("invalid SetChannelID rejected", func(t *testing.T) {
		rules := []CreationRule{{SetChannelID: "bad"}}
		require.Error(t, ValidateCreationRules(rules))
	})

	t.Run("invalid InviteUserIDs entry rejected", func(t *testing.T) {
		rules := []CreationRule{{InviteUserIDs: []string{validID, "bad-id"}}}
		require.Error(t, ValidateCreationRules(rules))
	})

	t.Run("error message includes rule index", func(t *testing.T) {
		rules := []CreationRule{
			{SetOwnerID: validID},
			{SetOwnerID: "bad"},
		}
		err := ValidateCreationRules(rules)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "creation rule 1")
	})
}
