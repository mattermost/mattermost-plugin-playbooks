// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react-hooks';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import {useToggleRunRetrospective} from './enable_disable_retrospective';

const mockDispatch = jest.fn();
const mockPatchRun = jest.fn().mockResolvedValue(undefined);
const mockOpenModal = jest.fn(() => ({type: 'OPEN_MODAL'}));
const mockMakeConfirmModal = jest.fn((args) => args);

jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: jest.fn(),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {
        ...reactIntl,
        useIntl: () => reactIntl.createIntl({locale: 'en'}),
    };
});

jest.mock('src/client', () => ({
    patchRun: (...args: unknown[]) => mockPatchRun(...args),
}));

jest.mock('src/webapp_globals', () => ({
    modals: {openModal: (...args: unknown[]) => mockOpenModal(...args)},
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (...args: unknown[]) => mockMakeConfirmModal(...args),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
}));

const makeRun = (overrides: Partial<PlaybookRun> = {}): PlaybookRun => ({
    id: 'run-1',
    name: 'Test Run',
    summary: '',
    summary_modified_at: 0,
    owner_user_id: 'user-owner',
    reporter_user_id: 'user-owner',
    team_id: 'team-1',
    channel_id: 'channel-1',
    create_at: 0,
    update_at: 0,
    end_at: 0,
    post_id: '',
    playbook_id: 'playbook-1',
    checklists: [],
    status_posts: [],
    current_status: RunStatus.InProgress,
    last_status_update_at: 0,
    reminder_post_id: '',
    reminder_message_template: '',
    reminder_timer_default_seconds: 0,
    status_update_enabled: true,
    broadcast_channel_ids: [],
    status_update_broadcast_webhooks_enabled: false,
    webhook_on_status_update_urls: [],
    status_update_broadcast_channels_enabled: false,
    previous_reminder: 0,
    timeline_events: [],
    retrospective: '',
    retrospective_published_at: 0,
    retrospective_was_canceled: false,
    retrospective_reminder_interval_seconds: 86400,
    retrospective_enabled: true,
    participant_ids: ['user-owner'],
    metrics_data: [],
    create_channel_member_on_new_participant: false,
    remove_channel_member_on_removed_participant: false,
    items_order: [],
    type: PlaybookRunType.Playbook,
    ...overrides,
});

describe('useToggleRunRetrospective', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('dispatches openModal when called', () => {
        const run = makeRun();
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(false);
        });

        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
    });

    it('calls patchRun with retrospective_enabled: false on confirm when disabling', async () => {
        const run = makeRun({retrospective_enabled: true});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(false);
        });

        // Extract the onConfirm callback from the modal definition
        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        await act(async () => {
            modalArgs.onConfirm();
            // Flush the promise chain from patchRun().then(...)
            await Promise.resolve();
        });

        expect(mockPatchRun).toHaveBeenCalledWith('run-1', {retrospective_enabled: false});
    });

    it('calls patchRun with retrospective_enabled: true on confirm when enabling', async () => {
        const run = makeRun({retrospective_enabled: false});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(true);
        });

        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        await act(async () => {
            modalArgs.onConfirm();
            await Promise.resolve();
        });

        expect(mockPatchRun).toHaveBeenCalledWith('run-1', {retrospective_enabled: true});
    });

    it('uses a "disable" confirm title when disabling', () => {
        const run = makeRun({retrospective_enabled: true});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(false);
        });

        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        expect(modalArgs.title).toMatch(/disable/i);
    });

    it('uses an "enable" confirm title when enabling', () => {
        const run = makeRun({retrospective_enabled: false});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(true);
        });

        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        expect(modalArgs.title).toMatch(/enable/i);
    });
});
