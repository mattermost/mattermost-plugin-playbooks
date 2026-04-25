// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react-hooks';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import {useToggleRunRetrospective} from './enable_disable_retrospective';

const mockDispatch = jest.fn();
const mockPatchRun = jest.fn().mockResolvedValue({id: 'run-1'});
const mockOpenModal: jest.Mock = jest.fn(() => ({type: 'OPEN_MODAL'}));
const mockMakeConfirmModal = jest.fn((args) => args);

jest.mock('react-redux', () => ({
    useDispatch: Object.assign(() => mockDispatch, {withTypes: () => () => mockDispatch}),
    useSelector: Object.assign(jest.fn(), {withTypes: () => jest.fn()}),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {
        ...reactIntl,
        useIntl: () => reactIntl.createIntl({locale: 'en'}),
    };
});

jest.mock('src/client', () => ({
    patchRun: (...args: any[]) => mockPatchRun(...args),
}));

jest.mock('src/actions', () => ({
    playbookRunUpdated: jest.fn((run) => ({type: 'PLAYBOOK_RUN_UPDATED', playbookRun: run})),
}));

jest.mock('src/webapp_globals', () => ({
    modals: {openModal: (arg: any) => mockOpenModal(arg)},
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (arg: any) => mockMakeConfirmModal(arg),
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

    it('dispatches playbookRunUpdated with the server response after disabling', async () => {
        const updatedRun = makeRun({retrospective_enabled: false});
        mockPatchRun.mockResolvedValueOnce(updatedRun);

        const run = makeRun({retrospective_enabled: true});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(false);
        });

        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        await act(async () => {
            modalArgs.onConfirm();
            await Promise.resolve();
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({type: 'PLAYBOOK_RUN_UPDATED', playbookRun: updatedRun}),
        );
    });

    it('dispatches playbookRunUpdated with the server response after enabling', async () => {
        const updatedRun = makeRun({retrospective_enabled: true});
        mockPatchRun.mockResolvedValueOnce(updatedRun);

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

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({type: 'PLAYBOOK_RUN_UPDATED', playbookRun: updatedRun}),
        );
    });

    it('does not dispatch playbookRunUpdated when patchRun returns an error', async () => {
        mockPatchRun.mockResolvedValueOnce({error: new Error('server error')});

        const run = makeRun({retrospective_enabled: true});
        const {result} = renderHook(() => useToggleRunRetrospective(run));

        act(() => {
            result.current(false);
        });

        const modalArgs = mockMakeConfirmModal.mock.calls[0][0];
        await act(async () => {
            modalArgs.onConfirm();
            await Promise.resolve();
        });

        const dispatchedTypes = mockDispatch.mock.calls.map((c) => c[0]?.type);
        expect(dispatchedTypes).not.toContain('PLAYBOOK_RUN_UPDATED');
    });
});
