package api

import (
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type playbookResolver struct {
	app.Playbook
}

func (r *playbookResolver) DeleteAt() float64 {
	return float64(r.Playbook.DeleteAt)
}

func (r *playbookResolver) RetrospectiveReminderIntervalSeconds() float64 {
	return float64(r.Playbook.RetrospectiveReminderIntervalSeconds)
}

func (r *playbookResolver) ReminderTimerDefaultSeconds() float64 {
	return float64(r.Playbook.ReminderTimerDefaultSeconds)
}

func (r *playbookResolver) Metrics() []*metricConfigResolver {
	metricConfigResolvers := make([]*metricConfigResolver, 0, len(r.Playbook.Metrics))
	for _, metricConfig := range r.Playbook.Metrics {
		metricConfigResolvers = append(metricConfigResolvers, &metricConfigResolver{metricConfig})
	}

	return metricConfigResolvers
}

type metricConfigResolver struct {
	app.PlaybookMetricConfig
}

func (r *metricConfigResolver) Target() *int32 {
	if r.PlaybookMetricConfig.Target.Valid {
		intvalue := int32(r.PlaybookMetricConfig.Target.ValueOrZero())
		return &intvalue
	} else {
		return nil
	}
}

func (r *playbookResolver) Checklists() []*checklistResolver {
	checklistResolvers := make([]*checklistResolver, 0, len(r.Playbook.Checklists))
	for _, checklist := range r.Playbook.Checklists {
		checklistResolvers = append(checklistResolvers, &checklistResolver{checklist})
	}

	return checklistResolvers
}

type checklistResolver struct {
	app.Checklist
}

func (r *checklistResolver) Items() []*checklistItemResolver {
	checklistItemResolvers := make([]*checklistItemResolver, 0, len(r.Checklist.Items))
	for _, items := range r.Checklist.Items {
		checklistItemResolvers = append(checklistItemResolvers, &checklistItemResolver{items})
	}

	return checklistItemResolvers
}

type checklistItemResolver struct {
	app.ChecklistItem
}

func (r *checklistItemResolver) StateModified() float64 {
	return float64(r.ChecklistItem.StateModified)
}

func (r *checklistItemResolver) AssigneeModified() float64 {
	return float64(r.ChecklistItem.AssigneeModified)
}

func (r *checklistItemResolver) CommandLastRun() float64 {
	return float64(r.ChecklistItem.CommandLastRun)
}

func (r *checklistItemResolver) DueDate() float64 {
	return float64(r.ChecklistItem.DueDate)
}
