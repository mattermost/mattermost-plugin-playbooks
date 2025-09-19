// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

// extractPropertyFieldIDs recursively extracts all property field IDs from a condition
func extractPropertyFieldIDs(condition app.ConditionExpr) []string {
	var fieldIDs []string
	fieldIDSet := make(map[string]struct{})

	extractFromCondition(condition, fieldIDSet)

	for fieldID := range fieldIDSet {
		fieldIDs = append(fieldIDs, fieldID)
	}

	return fieldIDs
}

func extractFromCondition(condition app.ConditionExpr, fieldIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Is != nil {
		fieldIDSet[condition.Is.FieldID] = struct{}{}
	}

	if condition.IsNot != nil {
		fieldIDSet[condition.IsNot.FieldID] = struct{}{}
	}
}

// extractPropertyOptionsIDs recursively extracts all property options IDs from a condition
func extractPropertyOptionsIDs(condition app.ConditionExpr) []string {
	var optionsIDs []string
	optionsIDSet := make(map[string]struct{})

	extractOptionsFromCondition(condition, optionsIDSet)

	for optionsID := range optionsIDSet {
		optionsIDs = append(optionsIDs, optionsID)
	}

	return optionsIDs
}

func extractOptionsFromCondition(condition app.ConditionExpr, optionsIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Is != nil {
		extractOptionsFromComparison(condition.Is, optionsIDSet)
	}

	if condition.IsNot != nil {
		extractOptionsFromComparison(condition.IsNot, optionsIDSet)
	}
}

func extractOptionsFromComparison(comparison *app.ComparisonCondition, optionsIDSet map[string]struct{}) {
	var arrayValue []string
	if err := json.Unmarshal(comparison.Value, &arrayValue); err == nil {
		// Successfully unmarshaled as array (select/multiselect fields)
		for _, optionID := range arrayValue {
			optionsIDSet[optionID] = struct{}{}
		}
	}
}
