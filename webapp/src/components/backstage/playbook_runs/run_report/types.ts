// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PlaybookRun} from 'src/types/playbook_run';
import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

export interface StatusPostComplete {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    user_id: string;
    channel_id: string;
    message: string;
    type: string;
    props: Record<string, unknown>;
    hashtags: string;
    pending_post_id: string;
}

export interface PlaybookRunExportData {
    run: PlaybookRun;
    status_updates: StatusPostComplete[];
    participants: UserProfile[];
    owner: UserProfile | null;
    channel: Channel | null;
    team: Team | null;
    chat_posts: StatusPostComplete[];
}

export interface ReportSections {
    coverPage: boolean;
    executiveSummary: boolean;
    timeline: boolean;
    statusUpdates: boolean;
    checklists: boolean;
    retrospective: boolean;
    chatLog: boolean;
}
