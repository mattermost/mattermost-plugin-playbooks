// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestPlaybookTiming(t *testing.T) {
	db := setupTestDB(t)
	store := setupPlaybookStore(t, db)

	playbook := NewPBBuilder().WithTitle("Incident").WithTeamID(model.NewId()).ToPlaybook()
	playbook.Checklists = []app.Checklist{{Title: "Triage", Items: []app.ChecklistItem{{Title: "Acknowledge"}, {ID: "temp_item_1", Title: "Contain"}}}}
	playbook.PlaybookType = app.PlaybookTypeExercise

	id, err := store.Create(playbook)
	require.NoError(t, err)

	saved, err := store.Get(id)
	require.NoError(t, err)
	ack := saved.Checklists[0].Items[0].ID
	assert.True(t, model.IsValidId(ack), "playbook tasks get stable IDs")
	assert.True(t, model.IsValidId(saved.Checklists[0].Items[1].ID))
	assert.Equal(t, app.PlaybookTypeExercise, saved.PlaybookType)
	assert.Empty(t, saved.TimingMetrics)

	saved.TimingMetrics = []app.TimingMetric{{
		ID:           model.NewId(),
		Name:         "Acknowledge",
		IndustryName: "MTTA",
		TargetMillis: 900000,
		Start:        app.TimingPoint{Type: app.TimingPointRunStarted},
		End:          app.TimingPoint{Type: app.TimingPointTaskFinished, ItemID: ack},
	}}
	saved.Checklists[0].Items = append(saved.Checklists[0].Items, app.ChecklistItem{Title: "Recover"})
	require.NoError(t, store.Update(saved))

	updated, err := store.Get(id)
	require.NoError(t, err)
	assert.Equal(t, ack, updated.Checklists[0].Items[0].ID, "existing task IDs survive edits")
	assert.True(t, model.IsValidId(updated.Checklists[0].Items[2].ID))
	assert.Equal(t, saved.TimingMetrics, updated.TimingMetrics)
}
