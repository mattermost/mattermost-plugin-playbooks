// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface Stats {
    total_reported_playbook_runs: number;
    total_active_playbook_runs: number;
    total_active_participants: number;
    average_duration_active_playbook_runs_minutes: number;
    active_playbook_runs: number[];
    people_in_playbook_runs: number[];
    average_start_to_active: number[];
    average_start_to_resolved: number[];
}

export interface PlaybookStats {
    runs_in_progress: number;
    participants_active: number;
    runs_finished_prev_30_days: number;
    runs_finished_percentage_change: number;
    runs_started_per_week: number[];
    runs_started_per_week_times: number[][];
    active_runs_per_day: number[];
    active_runs_per_day_times: number[][];
    active_participants_per_day: number[];
    active_participants_per_day_times: number[][];
    metric_overall_average: number[]; // indexed by metric, in the same order as playbook.metrics
    metric_rolling_average: number[]; // indexed by metric
    metric_rolling_average_change: number[];
    metric_value_range: number[][]; // indexed by metric, each array is a tuple: min max
    metric_rolling_values: number[][]; // indexed by metric, each array is that metric's last x runs values (reverse order: 0: most recent, 1: second most recent, etc.)
}

export const EmptyPlaybookStats = {
    runs_in_progress: 0,
    participants_active: 0,
    runs_finished_prev_30_days: 0,
    runs_finished_percentage_change: 0,
    runs_started_per_week: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    runs_started_per_week_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    active_runs_per_day: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    active_runs_per_day_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    active_participants_per_day: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    active_participants_per_day_times: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    metric_overall_average: [0, 0, 0, 0],
    metric_rolling_average: [0, 0, 0, 0],
    metric_rolling_average_change: [0, 0, 0, 0],
    metric_value_range: [[0, 0], [0, 0], [0, 0], [0, 0]],
    metric_rolling_values: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
} as PlaybookStats;

// TODO: adding values for development, remove
export const DevMetrics = {
    metric_overall_average: [8520340042, 1800, 6, 7500000],
    metric_rolling_average: [8500000000, 2200, 9, 5400000],
    metric_rolling_average_change: [15, -34, 120, 0],
    metric_value_range: [[3500000000, 10500000000], [0, 5900], [0, 49], [2500000, 7500000]],
    metric_rolling_values: [
        [3800000000, 4200000000, 4500000000, 4500000000, 0, 0, 0, 0, 7400000000, 5900000000],
        [1800, 800, 2800, 2200, 4400, 2100, 100, 900, 3800, 400],
        [4, 2, 1, 3, 4, 6, 10, 14, 3, 2],
        [8500000000, 8500000000, 0, 0, 0, 0, 8500000000, 8500000000, 8500000000, 8500000000],
    ],
};
