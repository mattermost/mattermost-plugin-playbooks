// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';
import {act} from '@testing-library/react-hooks';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import Retrospective from './retrospective';

const mockDispatch = jest.fn();
const mockPublishRetrospective = jest.fn().mockResolvedValue({});
const mockFetchPlaybookRun = jest.fn();
const mockUpdateRetrospective = jest.fn();
const mockPlaybookRunUpdated = jest.fn((run) => ({type: 'PLAYBOOK_RUN_UPDATED', playbookRun: run}));

// Captures the onConfirm callback passed to ConfirmModalLight so tests can invoke it directly.
let capturedOnConfirm: (() => void) | null = null;

jest.mock('react-redux', () => ({
    useDispatch: Object.assign(() => mockDispatch, {withTypes: () => () => mockDispatch}),
    useSelector: Object.assign(jest.fn(), {withTypes: () => jest.fn()}),
}));

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => mockDispatch,
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {
        ...reactIntl,
        useIntl: () => reactIntl.createIntl({locale: 'en'}),
    };
});

jest.mock('src/hooks', () => ({
    useAllowRetrospectiveAccess: () => true,
    useAllowPlaybookAndRunMetrics: () => false,
}));

jest.mock('src/client', () => ({
    publishRetrospective: (...args: any[]) => mockPublishRetrospective(...args),
    fetchPlaybookRun: (...args: any[]) => mockFetchPlaybookRun(...args),
    updateRetrospective: (...args: any[]) => mockUpdateRetrospective(...args),
}));

jest.mock('src/actions', () => ({
    playbookRunUpdated: (run: any) => mockPlaybookRunUpdated(run),
}));

jest.mock('src/components/widgets/confirmation_modal_light', () => ({
    __esModule: true,
    default: ({onConfirm}: {onConfirm: () => void}) => {
        capturedOnConfirm = onConfirm;
        return null;
    },
}));

jest.mock('src/components/backstage/playbook_runs/playbook_run/retrospective/report', () => ({
    __esModule: true,
    default: () => <div data-testid='retrospective-report'/>,
}));

jest.mock('src/components/backstage/playbook_runs/playbook_run/metrics/metrics_data', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(null),
}));

jest.mock('src/components/upgrade_banner', () => ({
    __esModule: true,
    default: () => <div data-testid='upgrade-banner'/>,
}));

jest.mock('src/webapp_globals', () => ({
    Timestamp: () => <span/>,
}));

jest.mock('src/components/backstage/playbook_runs/shared', () => ({
    AnchorLinkTitle: ({title}: {title: string}) => <div>{title}</div>,
    Content: ({children}: React.PropsWithChildren<unknown>) => <div>{children}</div>,
    Role: {Participant: 'Participant', Viewer: 'Viewer'},
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
    retrospective: 'Some retrospective text',
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
    run_number: 0,
    sequential_id: '',
    ...overrides,
});

const renderRetrospective = (run: PlaybookRun, role = 'Participant') =>
    renderer.create(
        <IntlProvider locale='en'>
            <Retrospective
                id='retrospective'
                playbookRun={run}
                playbook={null}
                role={role as any}
            />
        </IntlProvider>,
    );

describe('Retrospective', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        capturedOnConfirm = null;
        mockPublishRetrospective.mockResolvedValue({});
        mockFetchPlaybookRun.mockResolvedValue(makeRun());
    });

    it('renders null when retrospective_enabled is false', () => {
        const run = makeRun({retrospective_enabled: false});
        const tree = renderRetrospective(run).toJSON();
        expect(tree).toBeNull();
    });

    it('renders the section when retrospective_enabled is true', () => {
        const run = makeRun({retrospective_enabled: true});
        const tree = renderRetrospective(run).toJSON();
        expect(tree).not.toBeNull();
        expect(JSON.stringify(tree)).toContain('Retrospective');
    });

    describe('onConfirmPublish', () => {
        it('calls publishRetrospective with the run id and text', async () => {
            const run = makeRun({retrospective: 'My retro text', metrics_data: []});
            renderRetrospective(run);

            await act(async () => {
                capturedOnConfirm?.();
            });

            expect(mockPublishRetrospective).toHaveBeenCalledWith('run-1', 'My retro text', []);
        });

        it('fetches the updated run after publishing', async () => {
            const run = makeRun();
            renderRetrospective(run);

            await act(async () => {
                capturedOnConfirm?.();
            });

            expect(mockFetchPlaybookRun).toHaveBeenCalledWith('run-1');
        });

        it('dispatches playbookRunUpdated with the server-fetched run', async () => {
            const updatedRun = makeRun({retrospective_published_at: 9999});
            mockFetchPlaybookRun.mockResolvedValueOnce(updatedRun);

            const run = makeRun();
            renderRetrospective(run);

            await act(async () => {
                capturedOnConfirm?.();
            });

            expect(mockPlaybookRunUpdated).toHaveBeenCalledWith(updatedRun);
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({type: 'PLAYBOOK_RUN_UPDATED'}),
            );
        });

        it('dispatches playbookRunUpdated only after publishRetrospective resolves', async () => {
            let resolvePublish!: () => void;
            mockPublishRetrospective.mockReturnValueOnce(
                new Promise<void>((resolve) => {
                    resolvePublish = resolve;
                }),
            );

            const run = makeRun();
            renderRetrospective(run);

            // Kick off the confirm without awaiting
            act(() => {
                capturedOnConfirm?.();
            });

            // Not yet — publish hasn't resolved
            expect(mockFetchPlaybookRun).not.toHaveBeenCalled();
            expect(mockDispatch).not.toHaveBeenCalled();

            // Now resolve publish
            await act(async () => {
                resolvePublish();
            });

            expect(mockFetchPlaybookRun).toHaveBeenCalledWith('run-1');
            expect(mockDispatch).toHaveBeenCalledWith(
                expect.objectContaining({type: 'PLAYBOOK_RUN_UPDATED'}),
            );
        });
    });
});
