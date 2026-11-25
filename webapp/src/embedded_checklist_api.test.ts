// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EMBEDDED_CHECKLIST_API_VERSION, publishEmbeddedChecklistApi, unpublishEmbeddedChecklistApi} from 'src/embedded_checklist_api';
import {isChannelEmbedded} from 'src/components/embedded_checklist/embedded_run_registry';

jest.mock('src/components/embedded_checklist/embedded_checklist', () => ({
    __esModule: true,
    default: () => null,
}));

describe('embedded checklist api', () => {
    afterEach(() => {
        unpublishEmbeddedChecklistApi();
    });

    it('publishes the versioned contract on window', () => {
        publishEmbeddedChecklistApi();

        expect(window.MattermostPlaybooks?.version).toBe(EMBEDDED_CHECKLIST_API_VERSION);
        expect(EMBEDDED_CHECKLIST_API_VERSION).toBe(1);
        expect(typeof window.MattermostPlaybooks?.EmbeddedChecklist).toBe('function');
        expect(typeof window.MattermostPlaybooks?.suppressAutoOpen).toBe('function');
    });

    it('removes the global on unpublish', () => {
        publishEmbeddedChecklistApi();
        unpublishEmbeddedChecklistApi();

        expect(window.MattermostPlaybooks).toBeUndefined();
    });

    it('leaves a global it does not own in place', () => {
        const foreign = {version: 2} as unknown as Window['MattermostPlaybooks'];
        publishEmbeddedChecklistApi();
        window.MattermostPlaybooks = foreign;

        unpublishEmbeddedChecklistApi();

        expect(window.MattermostPlaybooks).toBe(foreign);
        delete window.MattermostPlaybooks;
    });

    it('suppresses auto-open until released through the exported helper', () => {
        publishEmbeddedChecklistApi();

        const release = window.MattermostPlaybooks!.suppressAutoOpen('channel_1');
        expect(isChannelEmbedded('channel_1')).toBe(true);

        release();
        expect(isChannelEmbedded('channel_1')).toBe(false);
    });

    it('clears channel suppression on unpublish', () => {
        publishEmbeddedChecklistApi();
        window.MattermostPlaybooks!.suppressAutoOpen('channel_1');

        unpublishEmbeddedChecklistApi();

        expect(isChannelEmbedded('channel_1')).toBe(false);
    });
});
