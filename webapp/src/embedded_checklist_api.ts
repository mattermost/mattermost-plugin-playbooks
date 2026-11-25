// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import EmbeddedChecklist from 'src/components/embedded_checklist/embedded_checklist';
import type {EmbeddedChecklistProps} from 'src/components/embedded_checklist/embedded_checklist';
import {resetEmbeddedRegistry, suppressAutoOpen} from 'src/components/embedded_checklist/embedded_run_registry';

/** Raised only for changes that break callers; other plugins check it before rendering. */
export const EMBEDDED_CHECKLIST_API_VERSION = 1;

export type PlaybooksEmbedApi = {
    version: number;
    EmbeddedChecklist: React.ComponentType<EmbeddedChecklistProps>;

    /** Stops the Playbooks RHS from auto-opening in the channel until the returned function is called. */
    suppressAutoOpen: (channelId: string) => () => void;
};

declare global {
    interface Window {
        MattermostPlaybooks?: PlaybooksEmbedApi;
    }
}

const api: PlaybooksEmbedApi = {version: EMBEDDED_CHECKLIST_API_VERSION, EmbeddedChecklist, suppressAutoOpen};

/** Makes the embedded checklist available to other plugins as `window.MattermostPlaybooks`. */
export function publishEmbeddedChecklistApi() {
    window.MattermostPlaybooks = api;
}

export function unpublishEmbeddedChecklistApi() {
    if (window.MattermostPlaybooks === api) {
        delete window.MattermostPlaybooks;
    }
    resetEmbeddedRegistry();
}
