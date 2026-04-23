// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/sirupsen/logrus"
)

// evaluateCreationRules applies creation rules to a run at creation time.
// Rules are evaluated in order:
//   - For SetOwnerID and SetChannelID: first-match-wins (once set, later rules don't override).
//   - For InviteUserIDs: accumulate across all matching rules (deduplicated).
//
// A rule with a nil Condition always matches (catch-all / default rule).
// The function mutates run.OwnerUserID, run.ChannelID, and run.InvitedUserIDs.
//
// Note: SetOwnerID and SetChannelID override the run's OwnerUserID and ChannelID
// that were set by the caller before evaluateCreationRules was invoked.
// Callers must post-validate that the overridden OwnerUserID is a member of the
// run's team (done in ResolveRunCreationParams) and that ChannelID is accessible
// (done in createPlaybookRun).
func evaluateCreationRules(rules []CreationRule, run *PlaybookRun) {
	if run == nil {
		return
	}
	if len(rules) == 0 {
		return
	}

	valueMap := make(map[string]PropertyValue, len(run.PropertyValues))
	for _, pv := range run.PropertyValues {
		valueMap[pv.FieldID] = pv
	}

	ownerSet := false
	channelSet := false
	seen := make(map[string]struct{})
	var newInvites []string
	capLogged := false

	for _, rule := range rules {
		if !matchesCreationCondition(rule.Condition, valueMap) {
			continue
		}
		if !ownerSet && rule.SetOwnerID != "" {
			run.OwnerUserID = rule.SetOwnerID
			ownerSet = true
		}
		if !channelSet && rule.SetChannelID != "" {
			run.ChannelID = rule.SetChannelID
			channelSet = true
		}
		for _, uid := range rule.InviteUserIDs {
			if len(newInvites) >= maxInviteUsersPerRun {
				if !capLogged {
					logrus.WithField("playbook_run_owner", run.OwnerUserID).
						Warn("creation rules: invite user cap reached; additional users will not be invited")
					capLogged = true
				}
				break
			}
			if _, ok := seen[uid]; !ok {
				seen[uid] = struct{}{}
				newInvites = append(newInvites, uid)
			}
		}
	}

	if len(newInvites) > 0 {
		// Remove users that are already invited, preserving rule-iteration order.
		alreadyInvited := make(map[string]struct{}, len(run.InvitedUserIDs))
		for _, uid := range run.InvitedUserIDs {
			alreadyInvited[uid] = struct{}{}
		}
		for _, uid := range newInvites {
			if _, ok := alreadyInvited[uid]; !ok {
				run.InvitedUserIDs = append(run.InvitedUserIDs, uid)
			}
		}
	}
}

// maxCreationConditionDepth caps recursion in the evaluator to match the depth
// enforced by ConditionExprV1.Validate, preventing divergence between validation
// and runtime behaviour.
const maxCreationConditionDepth = MaxConditionDepth

// maxInviteUsersPerRun is the maximum number of users that creation rules may
// invite to a single run. Prevents run creation from being used to mass-invite
// users by stacking many rules.
const maxInviteUsersPerRun = 50

// matchesCreationCondition evaluates a condition against the given value map.
// A nil condition is treated as an unconditional match (catch-all rule).
func matchesCreationCondition(cond *ConditionExprV1, valueMap map[string]PropertyValue) bool {
	return matchesCreationConditionAtDepth(cond, valueMap, 0)
}

func matchesCreationConditionAtDepth(cond *ConditionExprV1, valueMap map[string]PropertyValue, depth int) bool {
	if cond == nil {
		return true
	}
	if cond.And != nil {
		// Depth check mirrors ConditionExprV1.Validate: reject And/Or nesting beyond MaxConditionDepth.
		if depth >= maxCreationConditionDepth {
			return false
		}
		for i := range cond.And {
			if !matchesCreationConditionAtDepth(&cond.And[i], valueMap, depth+1) {
				return false
			}
		}
		return true
	}
	if cond.Or != nil {
		if depth >= maxCreationConditionDepth {
			return false
		}
		for i := range cond.Or {
			if matchesCreationConditionAtDepth(&cond.Or[i], valueMap, depth+1) {
				return true
			}
		}
		return false
	}
	if cond.Is != nil {
		return creationRuleValueMatches(cond.Is.FieldID, cond.Is.Value, valueMap)
	}
	if cond.IsNot != nil {
		return !creationRuleValueMatches(cond.IsNot.FieldID, cond.IsNot.Value, valueMap)
	}
	// All fields nil — empty condition expression, treat as catch-all (same semantics as nil).
	return true
}

// creationRuleValueMatches returns true if the property value for fieldID
// is present in conditionValue (array match for select/multiselect, or
// case-insensitive equality for text fields).
func creationRuleValueMatches(fieldID string, conditionValue json.RawMessage, valueMap map[string]PropertyValue) bool {
	pv, ok := valueMap[fieldID]
	if !ok || pv.Value == nil {
		return false
	}

	// Try array condition (select / multiselect fields).
	var condArr []string
	if err := json.Unmarshal(conditionValue, &condArr); err == nil {
		// Single-value property (select).
		var pvStr string
		if err := json.Unmarshal(pv.Value, &pvStr); err == nil {
			return slices.Contains(condArr, pvStr)
		}
		// Multi-value property (multiselect).
		var pvArr []string
		if err := json.Unmarshal(pv.Value, &pvArr); err == nil {
			for _, condItem := range condArr {
				if slices.Contains(pvArr, condItem) {
					return true
				}
			}
		}
		return false
	}

	// Try string condition (text field).
	var condStr string
	if err := json.Unmarshal(conditionValue, &condStr); err == nil {
		var pvStr string
		if err := json.Unmarshal(pv.Value, &pvStr); err == nil {
			return strings.EqualFold(pvStr, condStr)
		}
	}

	return false
}
