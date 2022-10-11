package transform

import (
	"fmt"
	"time"

	boards "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

type PlaybookRuns []app.PlaybookRun

// BoardsPlaybookRun holds the logic to transform a collection of playbook runs
// into a collection of boards blocks
//
// Still missing fields
// - Status Overdue > Select: Status
// - Status Due Date > Date: Status Due Date
type BoardsPlaybookRuns struct {
	PlaybookRuns []app.PlaybookRun
	Playbooks    map[string]app.Playbook
	Posts        map[string]*model.Post
	BoardID      string
	SiteURL      string
}

// Transform creates board's blocks for each of the runs:
// - one type card for each run
// - one type text for each run's description
func (b *BoardsPlaybookRuns) Transform() []boards.Block {
	blocks := make([]boards.Block, 0)

	for _, run := range b.PlaybookRuns {

		// overdue computations
		nextStatusDueDate := time.Time{}
		nextStatusOverdue := ""
		if run.CurrentStatus == app.StatusInProgress && run.PreviousReminder != 0 {
			nextStatusOverdue = "OnTrack"
			nextStatusDueDate = time.Unix(run.LastStatusUpdateAt/1e3, 0).Add(run.PreviousReminder)
			if nextStatusDueDate.Before(time.Now()) {
				nextStatusOverdue = "Overdue"
			}
		}

		// status computations
		status := run.CurrentStatus
		if run.CurrentStatus == app.StatusFinished && run.RetrospectivePublishedAt != 0 {
			status = "RetroPublished"
		}

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
					"playbook_run_status":                    status,
					"playbook_run_owner":                     run.OwnerUserID,
					"playbook_run_url":                       fmt.Sprintf("%s/playbooks/runs/%s", b.SiteURL, run.ID),
					"playbook_url":                           fmt.Sprintf("%s/playbooks/playbooks/%s", b.SiteURL, run.PlaybookID),
					"playbook_run_next_statusupdate_duedate": fmt.Sprintf("{\"from\": %d}", nextStatusDueDate.Unix()*1e3),
					"playbook_run_next_statusupdate_status":  nextStatusOverdue,
				},
				"contentOrder": []string{fmt.Sprintf("A+%s+summary", run.ID)},
			},
			CreateAt: run.CreateAt,
		}

		// extract name from playbook
		if pb, ok := b.Playbooks[run.PlaybookID]; ok {
			fields := block.Fields["properties"].(map[string]interface{})
			fields["playbook_name"] = pb.Title
			block.Fields["properties"] = fields
		}

		// add card block
		blocks = append(blocks, block)

		// Create a boards TypeText-block for each of the runs to hold the run summary
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

		// Create a boards TypeComment-block for each of the runs to hold the run summary
		for _, s := range run.StatusPosts {
			post, ok := b.Posts[s.ID]
			if ok {
				blocks = append(blocks, boards.Block{
					ID:         fmt.Sprintf("A+%s+status", run.ID),
					ParentID:   fmt.Sprintf("A+%s", run.ID),
					CreatedBy:  post.UserId,
					ModifiedBy: post.UserId,
					BoardID:    b.BoardID,
					Schema:     1,
					Type:       boards.TypeComment,
					Title:      post.Message,
					CreateAt:   post.CreateAt,
				})
			}
		}
	}

	return blocks
}

type Playbooks []app.Playbook

type BoardsPlaybooks struct {
	Playbooks
}

type BoardsPlaybook struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	LastRunAt   int64  `json:"last_run_at"`
}

func (b *BoardsPlaybooks) Transform() []BoardsPlaybook {
	items := make([]BoardsPlaybook, 0)
	for _, playbook := range b.Playbooks {
		pbType := "O"
		if !playbook.Public {
			pbType = "P"
		}

		items = append(items, BoardsPlaybook{
			ID:          playbook.ID,
			Name:        playbook.Title,
			Description: playbook.Description,
			LastRunAt:   playbook.LastRunAt,
			Type:        pbType,
		})
	}
	return items
}

type BoardsPlaybooksMembers struct {
	Playbooks
}
type Member struct {
	UserID string `json:"userId"`
}

func (b *BoardsPlaybooksMembers) Transform() []Member {
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

	members := make([]Member, 0)
	for _, fm := range finalMembers {
		members = append(members, Member{
			UserID: fm,
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
