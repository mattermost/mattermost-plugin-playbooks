package transform

import (
	"fmt"

	boards "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PlaybookRuns []app.PlaybookRun

// BoardsPlaybookRun holds the logic to transform a collection of playbook runs
// into a collection of boards blocks
//
// - Still missing fields
// - Status Overdue > Select: Status
// - Status Due Date > Date: Status Due Date
type BoardsPlaybookRuns struct {
	PlaybookRuns []app.PlaybookRun
	Playbooks    []app.Playbook
	BoardID      string
	SiteURL      string
}

// Transform creates a boards TypeCard-block for each of the runs
func (b *BoardsPlaybookRuns) Transform() []boards.Block {
	blocks := make([]boards.Block, 0)

	for _, run := range b.PlaybookRuns {
		block := boards.Block{
			ID:         fmt.Sprintf("A+%s", run.ID),
			ParentID:   "",
			CreatedBy:  run.ReporterUserID,
			ModifiedBy: run.ReporterUserID,
			BoardID:    b.BoardID,
			Schema:     1,
			Type:       boards.TypeCard,
			Title:      run.Name,
			Fields: map[string]interface{}{
				"properties": map[string]interface{}{
					"playbook_run_status": run.CurrentStatus,
					"playbook_run_owner":  run.OwnerUserID,
					"playbook_run_url":    fmt.Sprintf("%s/playbooks/runs/%s", b.SiteURL, run.ID),
					"playbook_url":        fmt.Sprintf("%s/playbooks/playbooks/%s", b.SiteURL, run.PlaybookID),
				},
				"contentOrder": []string{fmt.Sprintf("A+%s+summary", run.ID)},
			},
			CreateAt: run.CreateAt,
		}
		// extract name from playbook
		for _, pb := range b.Playbooks {
			if pb.ID == run.PlaybookID {
				fields := block.Fields["properties"].(map[string]interface{})
				fields["playbook_name"] = pb.Title
				block.Fields["properties"] = fields
			}
		}
		blocks = append(blocks, block)
	}

	// Create a boards TypeText-block for each of the runs to hold the run summary
	for _, run := range b.PlaybookRuns {
		blocks = append(blocks, boards.Block{
			ID:         fmt.Sprintf("A+%s+summary", run.ID),
			ParentID:   fmt.Sprintf("A+%s", run.ID),
			CreatedBy:  run.ReporterUserID,
			ModifiedBy: run.ReporterUserID,
			BoardID:    b.BoardID,
			Schema:     1,
			Type:       boards.TypeText,
			Title:      run.Summary,
			CreateAt:   run.CreateAt,
		})
	}

	return blocks
}

type Playbooks []app.Playbook

type BoardsPlaybooks struct {
	Playbooks
}

type BoardsPlaybook struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

func (b *BoardsPlaybooks) Transform() []BoardsPlaybook {
	items := make([]BoardsPlaybook, 0)
	for _, playbook := range b.Playbooks {
		pbType := "O"
		if !playbook.Public {
			pbType = "P"
		}
		items = append(items, BoardsPlaybook{
			ID:   playbook.ID,
			Name: playbook.Title,
			Type: pbType,
		})
	}
	return items
}

type BoardsPlaybooksMembers struct {
	Playbooks
}

func (b *BoardsPlaybooksMembers) Transform() []boards.BoardMember {
	participantByPlaybook := make(map[string][]string, 0)
	for _, playbook := range b.Playbooks {
		if len(participantByPlaybook[playbook.ID]) == 0 {
			participantByPlaybook[playbook.ID] = make([]string, 0)
		}
		for _, m := range playbook.Members {
			participantByPlaybook[playbook.ID] = append(participantByPlaybook[playbook.ID], m.UserID)
		}
	}

	finalMembers := make([]string, 0)
	for _, sl := range participantByPlaybook {
		if len(finalMembers) == 0 {
			finalMembers = sl
		} else {
			finalMembers = intersection(finalMembers, sl)
		}
	}

	members := make([]boards.BoardMember, 0)
	for _, fm := range finalMembers {
		members = append(members, boards.BoardMember{
			UserID:       fm,
			SchemeViewer: true,
		})
	}

	return members
}

func intersection(s1, s2 []string) (inter []string) {
	hash := make(map[string]bool)
	for _, e := range s1 {
		hash[e] = true
	}
	for _, e := range s2 {
		if hash[e] {
			inter = append(inter, e)
		}
	}
	inter = removeDuplicates(inter)
	return
}

//Remove duplicated values from slice.
func removeDuplicates(elements []string) (nodups []string) {
	encountered := make(map[string]bool)
	for _, element := range elements {
		if !encountered[element] {
			nodups = append(nodups, element)
			encountered[element] = true
		}
	}
	return
}
