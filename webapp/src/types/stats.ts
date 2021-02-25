// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface PlaybookUse {
    name: string
    num_uses: number
}

export interface Stats {
    total_reported_incidents: number
    total_active_incidents: number
    total_active_participants: number
    average_duration_active_incidents_minutes: number
    playbook_uses: PlaybookUse[]
}
