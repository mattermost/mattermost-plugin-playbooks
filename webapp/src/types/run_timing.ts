// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimingMetricResult} from './timing_metrics';

export interface ChecklistItemTiming {
    checklist_id: string;
    item_id: string;
    started_at: number;
    finished_at: number;
    reopened: boolean;
    blocked_millis: number;
    block_count: number;
    blocked_since: number;
}

export interface RunTiming {
    items: ChecklistItemTiming[];
    duration_millis: number;
    waiting_millis: number;
    blocked_items: number;
    metrics: TimingMetricResult[];
    computed_at: number;
}
