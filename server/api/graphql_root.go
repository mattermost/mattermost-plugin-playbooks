package api

import (
	"context"
	"strings"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type RootResolver struct {
	RunMutationCollection
	PlaybookMutationCollection
}

func (r *RootResolver) Playbook(ctx context.Context, args struct {
	ID string
}) (*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	playbookID := args.ID
	userID := c.r.Header.Get("Mattermost-User-ID")

	if err := c.permissions.PlaybookView(userID, playbookID); err != nil {
		c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
		return nil, errors.New("Not authorized")
	}

	playbook, err := c.playbookService.Get(playbookID)
	if err != nil {
		return nil, err
	}

	return &PlaybookResolver{playbook}, nil
}

func (r *RootResolver) Playbooks(ctx context.Context, args struct {
	TeamID             string
	Sort               string
	Direction          string
	SearchTerm         string
	WithMembershipOnly bool
	WithArchived       bool
}) ([]*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	if args.TeamID != "" {
		if err := c.permissions.PlaybookList(userID, args.TeamID); err != nil {
			c.log.Warnf("public error message: %v; internal details: %v", "Not authorized", err)
			return nil, errors.New("Not authorized")
		}
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.pluginAPI),
	}

	opts := app.PlaybookFilterOptions{
		Sort:               app.SortField(args.Sort),
		Direction:          app.SortDirection(args.Direction),
		SearchTerm:         args.SearchTerm,
		WithArchived:       args.WithArchived,
		WithMembershipOnly: args.WithMembershipOnly,
		Page:               0,
		PerPage:            10000,
	}

	playbookResults, err := c.playbookService.GetPlaybooksForTeam(requesterInfo, args.TeamID, opts)
	if err != nil {
		return nil, err
	}

	ret := make([]*PlaybookResolver, 0, len(playbookResults.Items))
	for _, pb := range playbookResults.Items {
		ret = append(ret, &PlaybookResolver{pb})
	}

	return ret, nil
}

func (r *RootResolver) Runs(ctx context.Context, args struct {
	TeamID                  string `url:"team_id,omitempty"`
	Sort                    string
	Statuses                []string
	ParticipantOrFollowerID string `url:"participant_or_follower,omitempty"`
}) ([]*RunResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  args.TeamID,
		IsAdmin: app.IsSystemAdmin(userID, c.pluginAPI),
	}

	if args.ParticipantOrFollowerID == client.Me {
		args.ParticipantOrFollowerID = userID
	}

	filterOptions := app.PlaybookRunFilterOptions{
		Sort:                    app.SortField(args.Sort),
		TeamID:                  args.TeamID,
		Statuses:                args.Statuses,
		ParticipantOrFollowerID: args.ParticipantOrFollowerID,
		Page:                    0,
		PerPage:                 10000,
	}

	runResults, err := c.playbookRunService.GetPlaybookRuns(requesterInfo, filterOptions)
	if err != nil {
		return nil, err
	}

	ret := make([]*RunResolver, 0, len(runResults.Items))
	for _, run := range runResults.Items {
		ret = append(ret, &RunResolver{run})
	}

	return ret, nil
}

type UpdateChecklist struct {
	Title string                `json:"title"`
	Items []UpdateChecklistItem `json:"items"`
}

type UpdateChecklistItem struct {
	Title            string  `json:"title"`
	State            string  `json:"state"`
	StateModified    float64 `json:"state_modified"`
	AssigneeID       string  `json:"assignee_id"`
	AssigneeModified float64 `json:"assignee_modified"`
	Command          string  `json:"command"`
	CommandLastRun   float64 `json:"command_last_run"`
	Description      string  `json:"description"`
	LastSkipped      float64 `json:"delete_at"`
	DueDate          float64 `json:"due_date"`
}

func addToSetmap[T any](setmap map[string]interface{}, name string, value *T) {
	if value != nil {
		setmap[name] = *value
	}
}

func addConcatToSetmap(setmap map[string]interface{}, name string, value *[]string) {
	if value != nil {
		setmap[name] = strings.Join(*value, ",")
	}
}
