// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"math"
	"sort"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

// MaxTimingReportRuns bounds how many runs a timing report reads.
const MaxTimingReportRuns = 1000

type TimingReportOptions struct {
	TeamID           string
	PlaybookID       string
	IncludeExercises bool

	// StartedGTE, when not zero, only includes runs started at or after it.
	StartedGTE int64
}

// TimingReport aggregates timing metrics across the runs a user can see.
type TimingReport struct {
	RunCount int `json:"run_count"`

	// Truncated is true when more runs matched than the report reads.
	Truncated bool `json:"truncated"`

	Metrics []TimingReportMetric `json:"metrics"`
	Rows    []TimingReportRow    `json:"rows"`

	// Steps is only filled when the report is for a single playbook.
	Steps []TimingReportStep `json:"steps"`
}

// TimingReportMetric summarizes metrics sharing a group key, so MTTA from different playbooks
// lands in one line.
type TimingReportMetric struct {
	Key          string `json:"key"`
	Name         string `json:"name"`
	IndustryName string `json:"industry_name"`

	// TargetMillis is the shared target, 0 when the grouped metrics disagree or have none.
	TargetMillis int64 `json:"target_millis"`

	MeasuredCount     int `json:"measured_count"`
	MetCount          int `json:"met_count"`
	MissedCount       int `json:"missed_count"`
	InProgressCount   int `json:"in_progress_count"`
	UnmeasurableCount int `json:"unmeasurable_count"`

	MedianMillis int64 `json:"median_millis"`
	P90Millis    int64 `json:"p90_millis"`

	// HitRate is met / (met + missed), or -1 when no measured run had a target.
	HitRate float64 `json:"hit_rate"`
}

// TimingReportRow is one metric of one run, for export.
type TimingReportRow struct {
	RunID        string `json:"run_id"`
	RunName      string `json:"run_name"`
	PlaybookID   string `json:"playbook_id"`
	Exercise     bool   `json:"exercise"`
	RunCreateAt  int64  `json:"run_create_at"`
	RunEndAt     int64  `json:"run_end_at"`
	MetricName   string `json:"metric_name"`
	IndustryName string `json:"industry_name"`
	TargetMillis int64  `json:"target_millis"`
	ValueMillis  int64  `json:"value_millis"`
	Status       string `json:"status"`
}

// TimingReportStep is how one playbook task performed across runs.
type TimingReportStep struct {
	ItemID         string `json:"item_id"`
	Title          string `json:"title"`
	ChecklistTitle string `json:"checklist_title"`

	// MedianMillis is the median start-to-finish time over the TimedRuns that started the task
	// before finishing it.
	FinishedRuns int   `json:"finished_runs"`
	TimedRuns    int   `json:"timed_runs"`
	MedianMillis int64 `json:"median_millis"`

	BlockedRuns         int   `json:"blocked_runs"`
	BlockCount          int   `json:"block_count"`
	MedianBlockedMillis int64 `json:"median_blocked_millis"`
}

// GetTimingReport aggregates timing metrics across the playbook runs the requester can view.
func (s *PlaybookRunServiceImpl) GetTimingReport(requesterInfo RequesterInfo, options TimingReportOptions) (*TimingReport, error) {
	results, err := s.GetPlaybookRuns(requesterInfo, PlaybookRunFilterOptions{
		TeamID:     options.TeamID,
		PlaybookID: options.PlaybookID,
		StartedGTE: options.StartedGTE,
		Types:      []string{RunTypePlaybook},
		Sort:       SortByCreateAt,
		Direction:  DirectionDesc,
		PerPage:    MaxTimingReportRuns,
		SkipExtras: true,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get playbook runs")
	}

	var runs []PlaybookRun
	for _, run := range results.Items {
		if run.Exercise && !options.IncludeExercises {
			continue
		}
		runs = append(runs, run)
	}

	runIDs := make([]string, 0, len(runs))
	for _, run := range runs {
		runIDs = append(runIDs, run.ID)
	}
	changesByRun, err := s.store.GetChecklistItemStateChangesForRuns(runIDs)
	if err != nil {
		return nil, err
	}

	now := model.GetMillis()
	timings := make([]RunTiming, len(runs))
	for i := range runs {
		timings[i] = ComputeRunTiming(&runs[i], changesByRun[runs[i].ID], now)
	}

	report := &TimingReport{
		RunCount:  len(runs),
		Truncated: results.HasMore,
		Metrics:   aggregateTimingMetrics(runs, timings),
		Rows:      timingReportRows(runs, timings),
		Steps:     []TimingReportStep{},
	}

	if options.PlaybookID != "" {
		playbook, err := s.playbookService.Get(options.PlaybookID)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get playbook")
		}
		report.Steps = aggregateTimingSteps(playbook, timings)
	}

	return report, nil
}

type metricGroup struct {
	metric  TimingReportMetric
	targets map[int64]bool
	values  []int64
}

func aggregateTimingMetrics(runs []PlaybookRun, timings []RunTiming) []TimingReportMetric {
	groups := make(map[string]*metricGroup)
	var order []string

	for i, run := range runs {
		metricsByID := make(map[string]TimingMetric, len(run.TimingMetrics))
		for _, metric := range run.TimingMetrics {
			metricsByID[metric.ID] = metric
		}

		for _, result := range timings[i].Metrics {
			key := metricsByID[result.MetricID].GroupKey()
			group, ok := groups[key]
			if !ok {
				group = &metricGroup{
					metric:  TimingReportMetric{Key: key, Name: result.Name, IndustryName: result.IndustryName},
					targets: make(map[int64]bool),
				}
				groups[key] = group
				order = append(order, key)
			}
			group.targets[result.TargetMillis] = true

			switch {
			case result.Measured():
				group.metric.MeasuredCount++
				group.values = append(group.values, result.ValueMillis)
			case result.Status == TimingMetricStatusUnmeasurable || result.Status == TimingMetricStatusNotReached:
				group.metric.UnmeasurableCount++
			default:
				group.metric.InProgressCount++
			}
			switch result.Status {
			case TimingMetricStatusMet:
				group.metric.MetCount++
			case TimingMetricStatusMissed:
				group.metric.MissedCount++
			}
		}
	}

	metrics := make([]TimingReportMetric, 0, len(order))
	for _, key := range order {
		group := groups[key]
		if len(group.targets) == 1 {
			for target := range group.targets {
				group.metric.TargetMillis = target
			}
		}
		group.metric.MedianMillis = percentile(group.values, 0.5)
		group.metric.P90Millis = percentile(group.values, 0.9)
		group.metric.HitRate = -1
		if withTarget := group.metric.MetCount + group.metric.MissedCount; withTarget > 0 {
			group.metric.HitRate = float64(group.metric.MetCount) / float64(withTarget)
		}
		metrics = append(metrics, group.metric)
	}
	return metrics
}

func timingReportRows(runs []PlaybookRun, timings []RunTiming) []TimingReportRow {
	rows := []TimingReportRow{}
	for i, run := range runs {
		for _, result := range timings[i].Metrics {
			rows = append(rows, TimingReportRow{
				RunID:        run.ID,
				RunName:      run.Name,
				PlaybookID:   run.PlaybookID,
				Exercise:     run.Exercise,
				RunCreateAt:  run.CreateAt,
				RunEndAt:     run.EndAt,
				MetricName:   result.Name,
				IndustryName: result.IndustryName,
				TargetMillis: result.TargetMillis,
				ValueMillis:  result.ValueMillis,
				Status:       result.Status,
			})
		}
	}
	return rows
}

func aggregateTimingSteps(playbook Playbook, timings []RunTiming) []TimingReportStep {
	type stepValues struct {
		finished int
		took     []int64
		blocked  []int64
	}
	values := make(map[string]*stepValues)
	blockCounts := make(map[string]int)
	for _, timing := range timings {
		for _, item := range timing.Items {
			v, ok := values[item.ItemID]
			if !ok {
				v = &stepValues{}
				values[item.ItemID] = v
			}
			if item.FinishedAt > 0 {
				v.finished++
				if item.StartedAt > 0 && item.FinishedAt >= item.StartedAt {
					v.took = append(v.took, item.FinishedAt-item.StartedAt)
				}
			}
			if item.BlockCount > 0 {
				v.blocked = append(v.blocked, item.BlockedMillis)
				blockCounts[item.ItemID] += item.BlockCount
			}
		}
	}

	steps := []TimingReportStep{}
	for _, checklist := range playbook.Checklists {
		for _, item := range checklist.Items {
			step := TimingReportStep{ItemID: item.ID, Title: item.Title, ChecklistTitle: checklist.Title}
			if v, ok := values[item.ID]; ok {
				step.FinishedRuns = v.finished
				step.TimedRuns = len(v.took)
				step.MedianMillis = percentile(v.took, 0.5)
				step.BlockedRuns = len(v.blocked)
				step.BlockCount = blockCounts[item.ID]
				step.MedianBlockedMillis = percentile(v.blocked, 0.5)
			}
			steps = append(steps, step)
		}
	}
	return steps
}

// percentile returns the nearest-rank percentile p (0 < p <= 1) of values, 0 when empty.
func percentile(values []int64, p float64) int64 {
	if len(values) == 0 {
		return 0
	}
	sorted := append([]int64(nil), values...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	rank := int(math.Ceil(p*float64(len(sorted)))) - 1
	return sorted[max(rank, 0)]
}
