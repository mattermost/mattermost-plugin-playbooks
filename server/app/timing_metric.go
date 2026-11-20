// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	PlaybookTypeOperational = ""
	PlaybookTypeExercise    = "exercise"
)

// Timing points a metric can be measured between.
const (
	TimingPointRunStarted   = "run_started"
	TimingPointTaskStarted  = "task_started"
	TimingPointTaskFinished = "task_finished"
)

// Industry names that make metrics comparable across playbooks.
var TimingMetricIndustryNames = []string{"MTTA", "MTTC", "MTTR"}

const (
	MaxTimingMetricsPerPlaybook = 20
	MaxTimingMetricNameLength   = 64
)

const (
	TimingMetricStatusPending      = "pending"
	TimingMetricStatusRunning      = "running"
	TimingMetricStatusMet          = "met"
	TimingMetricStatusMissed       = "missed"
	TimingMetricStatusDone         = "done"
	TimingMetricStatusNotReached   = "not_reached"
	TimingMetricStatusUnmeasurable = "unmeasurable"
)

// TimingPoint is one end of a timing metric. ItemID is set for task points.
type TimingPoint struct {
	Type   string `json:"type" export:"type"`
	ItemID string `json:"item_id,omitempty" export:"item_id"`
}

// TimingMetric measures the time between two points of a run, optionally against a target.
type TimingMetric struct {
	ID           string      `json:"id" export:"id"`
	Name         string      `json:"name" export:"name"`
	IndustryName string      `json:"industry_name" export:"industry_name"`
	TargetMillis int64       `json:"target_millis" export:"target_millis"`
	Start        TimingPoint `json:"start" export:"start"`
	End          TimingPoint `json:"end" export:"end"`
}

// TimingMetricResult is a metric's value for one run.
type TimingMetricResult struct {
	MetricID     string `json:"metric_id"`
	Name         string `json:"name"`
	IndustryName string `json:"industry_name"`
	TargetMillis int64  `json:"target_millis"`
	StartedAt    int64  `json:"started_at"`
	EndedAt      int64  `json:"ended_at"`

	// ValueMillis is the measured time, or the time elapsed so far while the metric is running.
	ValueMillis int64  `json:"value_millis"`
	Status      string `json:"status"`
}

// Measured reports whether both points were reached.
func (r TimingMetricResult) Measured() bool {
	return r.Status == TimingMetricStatusMet || r.Status == TimingMetricStatusMissed || r.Status == TimingMetricStatusDone
}

// GroupKey identifies metrics that should be compared with each other across playbooks.
func (m TimingMetric) GroupKey() string {
	if m.IndustryName != "" {
		return m.IndustryName
	}
	return strings.ToLower(strings.TrimSpace(m.Name))
}

func isTaskPoint(pointType string) bool {
	return pointType == TimingPointTaskStarted || pointType == TimingPointTaskFinished
}

// ValidateTimingMetrics normalizes metrics in place, assigning IDs to new ones. Every task point
// must refer to one of the checklists' tasks, unless the same metric in previous already had that
// point: a task removed after its metric was set up only makes the metric unmeasurable.
func ValidateTimingMetrics(metrics []TimingMetric, checklists []Checklist, previous []TimingMetric) error {
	if len(metrics) > MaxTimingMetricsPerPlaybook {
		return errors.Errorf("a playbook can have at most %d timing metrics", MaxTimingMetricsPerPlaybook)
	}

	itemIDs := make(map[string]bool)
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			itemIDs[item.ID] = true
		}
	}
	previousPoints := make(map[string][]TimingPoint, len(previous))
	for _, metric := range previous {
		previousPoints[metric.ID] = append(previousPoints[metric.ID], metric.Start, metric.End)
	}

	seen := make(map[string]bool)
	for i := range metrics {
		metric := &metrics[i]
		known := previousPoints[metric.ID]
		if !model.IsValidId(metric.ID) || seen[metric.ID] {
			metric.ID = model.NewId()
		}
		seen[metric.ID] = true

		metric.Name = strings.TrimSpace(metric.Name)
		if metric.Name == "" {
			return errors.New("timing metric name is required")
		}
		if utf8.RuneCountInString(metric.Name) > MaxTimingMetricNameLength {
			return errors.Errorf("timing metric name exceeds %d characters", MaxTimingMetricNameLength)
		}
		if metric.IndustryName != "" && !isIndustryName(metric.IndustryName) {
			return errors.Errorf("unknown industry name %q", metric.IndustryName)
		}
		if metric.TargetMillis < 0 {
			return errors.New("timing metric target cannot be negative")
		}
		for _, point := range []*TimingPoint{&metric.Start, &metric.End} {
			if err := validateTimingPoint(point, itemIDs, known); err != nil {
				return errors.Wrapf(err, "timing metric %q", metric.Name)
			}
		}
		if metric.Start == metric.End {
			return errors.Errorf("timing metric %q must start and end at different points", metric.Name)
		}
		if metric.End.Type == TimingPointRunStarted {
			return errors.Errorf("timing metric %q cannot end when the run starts", metric.Name)
		}
	}

	return nil
}

func validateTimingPoint(point *TimingPoint, itemIDs map[string]bool, known []TimingPoint) error {
	switch {
	case point.Type == TimingPointRunStarted:
		point.ItemID = ""
		return nil
	case isTaskPoint(point.Type):
		if point.ItemID == "" || (!itemIDs[point.ItemID] && !slices.Contains(known, *point)) {
			return errors.New("refers to a task that is not in the playbook")
		}
		return nil
	default:
		return errors.Errorf("unknown timing point %q", point.Type)
	}
}

// ValidatePlaybookType checks that playbookType is one of the known playbook types.
func ValidatePlaybookType(playbookType string) error {
	if playbookType != PlaybookTypeOperational && playbookType != PlaybookTypeExercise {
		return errors.Errorf("unknown playbook type %q", playbookType)
	}
	return nil
}

func isIndustryName(name string) bool {
	for _, n := range TimingMetricIndustryNames {
		if n == name {
			return true
		}
	}
	return false
}

// EnsureChecklistItemIDs gives every checklist item a unique, valid ID, keeping the ones it
// already has so timing metrics stay bound to their tasks across edits.
// It returns each replaced ID that was not a duplicate, mapped to the ID that replaced it.
func EnsureChecklistItemIDs(checklists []Checklist) map[string]string {
	seen := make(map[string]bool)
	replaced := make(map[string]string)
	for i := range checklists {
		for j := range checklists[i].Items {
			id := &checklists[i].Items[j].ID
			if !model.IsValidId(*id) || seen[*id] {
				newID := model.NewId()
				if _, ok := replaced[*id]; *id != "" && !seen[*id] && !ok {
					replaced[*id] = newID
				}
				*id = newID
			}
			seen[*id] = true
		}
	}
	return replaced
}

// RebindTimingMetrics points task points at the IDs that replaced the ones they referred to.
func RebindTimingMetrics(metrics []TimingMetric, replaced map[string]string) {
	for i := range metrics {
		for _, point := range []*TimingPoint{&metrics[i].Start, &metrics[i].End} {
			if newID, ok := replaced[point.ItemID]; ok && isTaskPoint(point.Type) {
				point.ItemID = newID
			}
		}
	}
}

// computeTimingMetrics evaluates the run's metrics from its item timings, as of runEnd.
func computeTimingMetrics(run *PlaybookRun, items map[string]ChecklistItemTiming, itemStates map[string]string, runEnd int64) []TimingMetricResult {
	results := make([]TimingMetricResult, 0, len(run.TimingMetrics))
	runActive := run.EndAt == 0

	for _, metric := range run.TimingMetrics {
		result := TimingMetricResult{
			MetricID:     metric.ID,
			Name:         metric.Name,
			IndustryName: metric.IndustryName,
			TargetMillis: metric.TargetMillis,
		}

		start, startOK := pointTime(metric.Start, run, items, itemStates)
		end, endOK := pointTime(metric.End, run, items, itemStates)
		result.StartedAt = start
		result.EndedAt = end

		switch {
		case !startOK || !endOK, start > 0 && end > 0 && end < start:
			result.Status = TimingMetricStatusUnmeasurable
		case start > 0 && end > 0:
			result.ValueMillis = end - start
			result.Status = TimingMetricStatusDone
			if metric.TargetMillis > 0 {
				result.Status = TimingMetricStatusMet
				if result.ValueMillis > metric.TargetMillis {
					result.Status = TimingMetricStatusMissed
				}
			}
		case start > 0 && runActive:
			result.ValueMillis = max(runEnd-start, 0)
			result.Status = TimingMetricStatusRunning
		case runActive:
			result.Status = TimingMetricStatusPending
		default:
			result.Status = TimingMetricStatusNotReached
		}

		results = append(results, result)
	}

	return results
}

// pointTime returns when the point was reached, 0 if not yet. ok is false when the point can no
// longer be reached because its task was removed or skipped.
func pointTime(point TimingPoint, run *PlaybookRun, items map[string]ChecklistItemTiming, itemStates map[string]string) (int64, bool) {
	if point.Type == TimingPointRunStarted {
		return run.CreateAt, true
	}

	state, exists := itemStates[point.ItemID]
	if !exists {
		return 0, false
	}

	timing := items[point.ItemID]
	at := timing.FinishedAt
	if point.Type == TimingPointTaskStarted && timing.StartedAt > 0 {
		at = timing.StartedAt
	}
	if at == 0 && state == ChecklistItemStateSkipped {
		return 0, false
	}
	return at, true
}
