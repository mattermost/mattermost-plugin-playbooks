// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checklist} from './playbook';

/**
 * Information about the thread that was analyzed for quicklist generation.
 * Includes truncation details when the thread exceeded configured limits.
 */
export interface ThreadInfo {
    truncated: boolean;
    truncated_count: number;
    message_count: number;
    participant_count: number;
}

/**
 * Response from the POST /api/v0/quicklist/generate endpoint.
 * Contains the AI-generated checklist and thread metadata.
 */
export interface QuicklistGenerateResponse {
    title: string;
    checklists: Checklist[];
    thread_info: ThreadInfo;
}

/**
 * Request body for the POST /api/v0/quicklist/refine endpoint.
 * Sends the current checklist state along with user feedback for AI refinement.
 */
export interface QuicklistRefineRequest {
    post_id: string;
    channel_id: string;
    current_checklists: Checklist[];
    feedback: string;
}

/**
 * Props for the quicklist modal component.
 * Passed via WebSocket event when the modal is opened.
 */
export interface QuicklistModalProps {
    postId: string;
    channelId: string;
}
