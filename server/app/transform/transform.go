package transform

import (
	"fmt"

	boards "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PlaybookRuns []app.PlaybookRun

type BoardsPlaybookRun struct {
	PlaybookRuns
}

func (b *BoardsPlaybookRun) Transform(boardID string) []boards.Block {
	blocks := make([]boards.Block, 0)

	// Still missing fields
	// Status Overdue > Select: Status
	// Status Due Date > Date: Status Due Date
	// Playbook name > Select: Playbook Name

	// Create a boards TypeCard - block for each of the runs
	for _, run := range b.PlaybookRuns {
		blocks = append(blocks, boards.Block{
			ID:         fmt.Sprintf("A+%s", run.ID),
			ParentID:   "",
			CreatedBy:  run.ReporterUserID,
			ModifiedBy: run.ReporterUserID,
			Schema:     1,
			Type:       boards.TypeCard,
			Title:      run.Name,
			Fields: map[string]interface{}{
				"playbook_run_status": run.CurrentStatus,
				"playbook_run_owner":  run.OwnerUserID,
				"playbook_run_url":    fmt.Sprintf("/playbooks/runs/%s", run.ID),
				"playbook_url":        fmt.Sprintf("/playbooks/%s", run.PlaybookID),
				"contentOrder":        []string{fmt.Sprintf("A+%s+summary", run.ID)},
			},
			CreateAt: run.CreateAt,
		})
	}

	// Create a boards Content - block for each of the runs
	for _, run := range b.PlaybookRuns {
		blocks = append(blocks, boards.Block{
			ID:         fmt.Sprintf("A+%s+summary", run.ID),
			ParentID:   fmt.Sprintf("A+%s", run.ID),
			CreatedBy:  run.OwnerUserID, // TODO: look for a better data
			ModifiedBy: run.OwnerUserID, // TODO: look for a better data
			Schema:     1,
			Type:       boards.TypeText,
			Title:      run.Summary,
			CreateAt:   run.CreateAt,
		})
	}

	return blocks
}

type BoardsPlaybook struct {
	app.Playbook
}

type PlaybookItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func (b *BoardsPlaybook) Transform() PlaybookItem {
	item := PlaybookItem{
		ID:   b.Playbook.ID,
		Name: b.Playbook.Title,
		Type: "O",
	}
	if !b.Playbook.Public {
		item.Type = "P"
	}
	return item
}
