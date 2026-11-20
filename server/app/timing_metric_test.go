// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const minute = int64(60 * 1000)

func runStarted() TimingPoint { return TimingPoint{Type: TimingPointRunStarted} }

func taskFinished(itemID string) TimingPoint {
	return TimingPoint{Type: TimingPointTaskFinished, ItemID: itemID}
}

func taskStarted(itemID string) TimingPoint {
	return TimingPoint{Type: TimingPointTaskStarted, ItemID: itemID}
}

func metricRun(metrics ...TimingMetric) *PlaybookRun {
	run := timingRun("ack", "contain")
	run.TimingMetrics = metrics
	return run
}

func TestValidateTimingMetrics(t *testing.T) {
	checklists := []Checklist{{Items: []ChecklistItem{{ID: "ack"}, {ID: "contain"}}}}
	valid := func() TimingMetric {
		return TimingMetric{Name: " Time to acknowledge ", IndustryName: "MTTA", TargetMillis: 15 * minute, Start: runStarted(), End: taskFinished("ack")}
	}

	t.Run("assigns IDs and trims names", func(t *testing.T) {
		metrics := []TimingMetric{valid(), valid()}
		metrics[1].Name = "Second"

		require.NoError(t, ValidateTimingMetrics(metrics, checklists))

		assert.True(t, model.IsValidId(metrics[0].ID))
		assert.NotEqual(t, metrics[0].ID, metrics[1].ID)
		assert.Equal(t, "Time to acknowledge", metrics[0].Name)
	})

	t.Run("skips the task check when no checklists are given", func(t *testing.T) {
		metric := valid()
		metric.End = taskFinished("removed")

		assert.NoError(t, ValidateTimingMetrics([]TimingMetric{metric}, nil))
		assert.Error(t, ValidateTimingMetrics([]TimingMetric{metric}, checklists))
	})

	for name, mutate := range map[string]func(*TimingMetric){
		"without a name":                func(m *TimingMetric) { m.Name = "  " },
		"with an overlong name":         func(m *TimingMetric) { m.Name = strings.Repeat("a", MaxTimingMetricNameLength+1) },
		"with an unknown industry name": func(m *TimingMetric) { m.IndustryName = "MTTX" },
		"with a negative target":        func(m *TimingMetric) { m.TargetMillis = -1 },
		"with an unknown point":         func(m *TimingMetric) { m.End = TimingPoint{Type: "whenever"} },
		"with a task point but no task": func(m *TimingMetric) { m.End = TimingPoint{Type: TimingPointTaskFinished} },
		"starting and ending the same":  func(m *TimingMetric) { m.Start = taskFinished("ack") },
		"ending when the run starts":    func(m *TimingMetric) { m.Start = taskFinished("ack"); m.End = runStarted() },
	} {
		t.Run("rejects a metric "+name, func(t *testing.T) {
			metric := valid()
			mutate(&metric)
			assert.Error(t, ValidateTimingMetrics([]TimingMetric{metric}, checklists))
		})
	}

	t.Run("rejects too many metrics", func(t *testing.T) {
		metrics := make([]TimingMetric, MaxTimingMetricsPerPlaybook+1)
		for i := range metrics {
			metrics[i] = valid()
		}
		assert.Error(t, ValidateTimingMetrics(metrics, checklists))
	})
}

func TestEnsureChecklistItemIDs(t *testing.T) {
	kept := model.NewId()
	checklists := []Checklist{
		{Items: []ChecklistItem{{ID: kept}, {ID: ""}, {ID: "temp_item_1"}}},
		{Items: []ChecklistItem{{ID: kept}}},
	}

	EnsureChecklistItemIDs(checklists)

	assert.Equal(t, kept, checklists[0].Items[0].ID, "valid IDs are kept so metrics stay bound")
	seen := map[string]bool{}
	for _, checklist := range checklists {
		for _, item := range checklist.Items {
			assert.True(t, model.IsValidId(item.ID))
			assert.False(t, seen[item.ID], "IDs must be unique")
			seen[item.ID] = true
		}
	}
}

func TestComputeTimingMetrics(t *testing.T) {
	const (
		open    = ChecklistItemStateOpen
		started = ChecklistItemStateInProgress
		closed  = ChecklistItemStateClosed
	)
	mtta := TimingMetric{ID: "m1", Name: "Acknowledge", IndustryName: "MTTA", TargetMillis: 15 * minute, Start: runStarted(), End: taskFinished("ack")}

	metric := func(t *testing.T, timing RunTiming) TimingMetricResult {
		t.Helper()
		require.Len(t, timing.Metrics, 1)
		return timing.Metrics[0]
	}

	t.Run("met when the end is reached within target", func(t *testing.T) {
		timing := ComputeRunTiming(metricRun(mtta), []ChecklistItemStateChange{
			change("ack", open, closed, 1000+10*minute),
		}, 1000+20*minute)

		result := metric(t, timing)
		assert.Equal(t, TimingMetricStatusMet, result.Status)
		assert.Equal(t, 10*minute, result.ValueMillis)
	})

	t.Run("missed when the end is reached after target", func(t *testing.T) {
		timing := ComputeRunTiming(metricRun(mtta), []ChecklistItemStateChange{
			change("ack", open, closed, 1000+30*minute),
		}, 1000+40*minute)

		assert.Equal(t, TimingMetricStatusMissed, metric(t, timing).Status)
	})

	t.Run("running until the end is reached", func(t *testing.T) {
		timing := ComputeRunTiming(metricRun(mtta), nil, 1000+5*minute)

		result := metric(t, timing)
		assert.Equal(t, TimingMetricStatusRunning, result.Status)
		assert.Equal(t, 5*minute, result.ValueMillis)
	})

	t.Run("pending until the start is reached", func(t *testing.T) {
		m := TimingMetric{ID: "m2", Name: "Contain", Start: taskStarted("contain"), End: taskFinished("contain")}
		timing := ComputeRunTiming(metricRun(m), nil, 5000)

		assert.Equal(t, TimingMetricStatusPending, metric(t, timing).Status)
	})

	t.Run("done without a target", func(t *testing.T) {
		m := TimingMetric{ID: "m2", Name: "Contain", Start: taskStarted("contain"), End: taskFinished("contain")}
		timing := ComputeRunTiming(metricRun(m), []ChecklistItemStateChange{
			change("contain", open, started, 2000),
			change("contain", started, closed, 9000),
		}, 10000)

		result := metric(t, timing)
		assert.Equal(t, TimingMetricStatusDone, result.Status)
		assert.Equal(t, int64(7000), result.ValueMillis)
	})

	t.Run("a task closed without being started starts when it finished", func(t *testing.T) {
		m := TimingMetric{ID: "m2", Name: "Contain", Start: taskStarted("contain"), End: taskFinished("contain")}
		timing := ComputeRunTiming(metricRun(m), []ChecklistItemStateChange{
			change("contain", open, closed, 9000),
		}, 10000)

		assert.Zero(t, metric(t, timing).ValueMillis)
	})

	t.Run("not reached when the run ends first", func(t *testing.T) {
		run := metricRun(mtta)
		run.EndAt = 5000
		timing := ComputeRunTiming(run, nil, 10000)

		assert.Equal(t, TimingMetricStatusNotReached, metric(t, timing).Status)
	})

	t.Run("unmeasurable when the task was removed", func(t *testing.T) {
		m := mtta
		m.End = taskFinished("removed")
		timing := ComputeRunTiming(metricRun(m), nil, 10000)

		assert.Equal(t, TimingMetricStatusUnmeasurable, metric(t, timing).Status)
	})

	t.Run("unmeasurable when the task was skipped", func(t *testing.T) {
		run := metricRun(mtta)
		run.Checklists[0].Items[0].State = ChecklistItemStateSkipped
		timing := ComputeRunTiming(run, nil, 10000)

		assert.Equal(t, TimingMetricStatusUnmeasurable, metric(t, timing).Status)
	})
}

func TestAggregateTimingMetrics(t *testing.T) {
	result := func(status string, value int64) TimingMetricResult {
		return TimingMetricResult{MetricID: "m1", Name: "Acknowledge", IndustryName: "MTTA", TargetMillis: 15 * minute, Status: status, ValueMillis: value}
	}
	run := PlaybookRun{TimingMetrics: []TimingMetric{{ID: "m1", Name: "Acknowledge", IndustryName: "MTTA"}}}
	statuses := []TimingMetricResult{
		result(TimingMetricStatusMet, 5*minute),
		result(TimingMetricStatusMet, 10*minute),
		result(TimingMetricStatusMet, 12*minute),
		result(TimingMetricStatusMissed, 40*minute),
		result(TimingMetricStatusRunning, 3*minute),
		result(TimingMetricStatusUnmeasurable, 0),
	}
	runs := make([]PlaybookRun, len(statuses))
	timings := make([]RunTiming, len(statuses))
	for i, r := range statuses {
		runs[i] = run
		timings[i] = RunTiming{Metrics: []TimingMetricResult{r}}
	}

	metrics := aggregateTimingMetrics(runs, timings)

	require.Len(t, metrics, 1)
	m := metrics[0]
	assert.Equal(t, "MTTA", m.Key)
	assert.Equal(t, 4, m.MeasuredCount)
	assert.Equal(t, 1, m.InProgressCount)
	assert.Equal(t, 1, m.UnmeasurableCount)
	assert.Equal(t, 10*minute, m.MedianMillis)
	assert.Equal(t, 40*minute, m.P90Millis)
	assert.Equal(t, 15*minute, m.TargetMillis)
	assert.InDelta(t, 0.75, m.HitRate, 0.0001)
}

func TestPercentile(t *testing.T) {
	assert.Zero(t, percentile(nil, 0.5))
	assert.Equal(t, int64(3), percentile([]int64{5, 1, 3}, 0.5))
	assert.Equal(t, int64(9), percentile([]int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, 0.9))
	assert.Equal(t, int64(7), percentile([]int64{7}, 0.9))
}

func TestAggregateTimingSteps(t *testing.T) {
	playbook := Playbook{Checklists: []Checklist{{Title: "Triage", Items: []ChecklistItem{{ID: "ack", Title: "Acknowledge"}, {ID: "contain", Title: "Contain"}}}}}
	timings := []RunTiming{
		{Items: []ChecklistItemTiming{{ItemID: "ack", FinishedAt: 5000}, {ItemID: "contain", StartedAt: 1000, FinishedAt: 4000, BlockCount: 2, BlockedMillis: 1500}}},
		{Items: []ChecklistItemTiming{{ItemID: "ack", StartedAt: 1000, FinishedAt: 3000}, {ItemID: "contain", StartedAt: 1000}}},
	}

	steps := aggregateTimingSteps(playbook, timings)

	require.Len(t, steps, 2)
	assert.Equal(t, TimingReportStep{ItemID: "ack", Title: "Acknowledge", ChecklistTitle: "Triage", FinishedRuns: 2, TimedRuns: 1, MedianMillis: 2000}, steps[0])
	assert.Equal(t, TimingReportStep{ItemID: "contain", Title: "Contain", ChecklistTitle: "Triage", FinishedRuns: 1, TimedRuns: 1, MedianMillis: 3000, BlockedRuns: 1, BlockCount: 2, MedianBlockedMillis: 1500}, steps[1])
}
