// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// CountOutstandingChecklistItemsForFinishRun returns how many checklist items are still
// incomplete for finish-run confirmation. Items hidden by run conditions (condition_action
// hidden) are excluded so the count matches visible checklist UX.
func CountOutstandingChecklistItemsForFinishRun(checklists []Checklist) int {
	n := 0
	for _, c := range checklists {
		for _, item := range c.Items {
			if item.ConditionAction == ConditionActionHidden {
				continue
			}
			if item.State == ChecklistItemStateOpen || item.State == ChecklistItemStateInProgress {
				n++
			}
		}
	}
	return n
}
