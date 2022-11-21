package api

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type PlaybookResolver struct {
	app.Playbook
}

func (r *PlaybookResolver) ChannelMode(ctx context.Context) string {
	return fmt.Sprint(r.Playbook.ChannelMode)
}

func (r *PlaybookResolver) IsFavorite(ctx context.Context) (bool, error) {
	c, err := getContext(ctx)
	if err != nil {
		return false, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	isFavorite, err := c.categoryService.IsItemFavorite(
		app.CategoryItem{
			ItemID: r.ID,
			Type:   app.PlaybookItemType,
		},
		r.TeamID,
		userID,
	)
	if err != nil {
		return false, errors.Wrap(err, "can't determine if item is favorite or not")
	}

	return isFavorite, nil
}

func (r *PlaybookResolver) DeleteAt() float64 {
	return float64(r.Playbook.DeleteAt)
}

func (r *PlaybookResolver) RetrospectiveReminderIntervalSeconds() float64 {
	return float64(r.Playbook.RetrospectiveReminderIntervalSeconds)
}

func (r *PlaybookResolver) ReminderTimerDefaultSeconds() float64 {
	return float64(r.Playbook.ReminderTimerDefaultSeconds)
}

func (r *PlaybookResolver) Metrics() []*MetricConfigResolver {
	metricConfigResolvers := make([]*MetricConfigResolver, 0, len(r.Playbook.Metrics))
	for _, metricConfig := range r.Playbook.Metrics {
		metricConfigResolvers = append(metricConfigResolvers, &MetricConfigResolver{metricConfig})
	}

	return metricConfigResolvers
}

type MetricConfigResolver struct {
	app.PlaybookMetricConfig
}

func (r *MetricConfigResolver) Target() *int32 {
	if r.PlaybookMetricConfig.Target.Valid {
		intvalue := int32(r.PlaybookMetricConfig.Target.ValueOrZero())
		return &intvalue
	}
	return nil
}

func (r *PlaybookResolver) Checklists() []*ChecklistResolver {
	checklistResolvers := make([]*ChecklistResolver, 0, len(r.Playbook.Checklists))
	for _, checklist := range r.Playbook.Checklists {
		checklistResolvers = append(checklistResolvers, &ChecklistResolver{checklist})
	}

	return checklistResolvers
}

type ChecklistResolver struct {
	app.Checklist
}

func (r *ChecklistResolver) Items() []*ChecklistItemResolver {
	checklistItemResolvers := make([]*ChecklistItemResolver, 0, len(r.Checklist.Items))
	for _, items := range r.Checklist.Items {
		checklistItemResolvers = append(checklistItemResolvers, &ChecklistItemResolver{items})
	}

	return checklistItemResolvers
}

type ChecklistItemResolver struct {
	app.ChecklistItem
}

func (r *ChecklistItemResolver) StateModified() float64 {
	return float64(r.ChecklistItem.StateModified)
}

func (r *ChecklistItemResolver) AssigneeModified() float64 {
	return float64(r.ChecklistItem.AssigneeModified)
}

func (r *ChecklistItemResolver) CommandLastRun() float64 {
	return float64(r.ChecklistItem.CommandLastRun)
}

func (r *ChecklistItemResolver) DueDate() float64 {
	return float64(r.ChecklistItem.DueDate)
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
