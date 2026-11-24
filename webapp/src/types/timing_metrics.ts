// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum PlaybookType {
    Operational = '',
    Exercise = 'exercise',
}

export enum TimingPointType {
    RunStarted = 'run_started',
    TaskStarted = 'task_started',
    TaskFinished = 'task_finished',
}

export const TIMING_INDUSTRY_NAMES = ['MTTA', 'MTTC', 'MTTR'];

export interface TimingPoint {
    type: TimingPointType;
    item_id?: string;
}

export interface TimingMetric {
    id: string;
    name: string;
    industry_name: string;
    target_millis: number;
    start: TimingPoint;
    end: TimingPoint;
}

export enum TimingMetricStatus {
    Pending = 'pending',
    Running = 'running',
    Met = 'met',
    Missed = 'missed',
    Done = 'done',
    NotReached = 'not_reached',
    Unmeasurable = 'unmeasurable',
}

export interface TimingMetricResult {
    metric_id: string;
    name: string;
    industry_name: string;
    target_millis: number;
    started_at: number;
    ended_at: number;
    value_millis: number;
    status: TimingMetricStatus;
}

export interface TimingReportMetric {
    key: string;
    name: string;
    industry_name: string;
    target_millis: number;
    measured_count: number;
    met_count: number;
    missed_count: number;
    in_progress_count: number;
    unmeasurable_count: number;
    median_millis: number;
    p90_millis: number;
    hit_rate: number;
}

export interface TimingReportRow {
    run_id: string;
    run_name: string;
    playbook_id: string;
    exercise: boolean;
    run_create_at: number;
    run_end_at: number;
    metric_name: string;
    industry_name: string;
    target_millis: number;
    value_millis: number;
    status: TimingMetricStatus;
}

export interface TimingReportStep {
    item_id: string;
    title: string;
    checklist_title: string;
    finished_runs: number;
    timed_runs: number;
    median_millis: number;
    blocked_runs: number;
    block_count: number;
    median_blocked_millis: number;
}

export interface TimingReport {
    run_count: number;
    truncated: boolean;
    metrics: TimingReportMetric[];
    rows: TimingReportRow[];
    steps: TimingReportStep[];
}
