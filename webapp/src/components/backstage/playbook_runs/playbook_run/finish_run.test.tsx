// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import FinishRun, {useFinishRunConfirmationMessage, useOnFinishRun} from './finish_run';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockFinishRun = jest.fn();
jest.mock('src/client', () => ({
    finishRun: (...args: any[]) => mockFinishRun(...args),
}));

const mockOpenModal = jest.fn();
jest.mock('src/webapp_globals', () => ({
    modals: {openModal: (...args: any[]) => mockOpenModal(...args)},
}));

const mockRefreshLHS = jest.fn();
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => mockRefreshLHS,
}));

const mockAddToast = jest.fn();
jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: mockAddToast}),
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (props: any) => ({type: 'CONFIRM_MODAL', props}),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: (selector: (state: any) => any) => selector({}),
}));

jest.mock('src/components/assets/buttons', () => ({
    TertiaryButton: ({children, onClick, disabled}: {children: React.ReactNode; onClick?: () => void; disabled?: boolean}) => (
        <button
            data-testid='finish-run-button'
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    ),
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    FlagOutlineIcon: () => <svg data-testid='flag-icon'/>,
}));

jest.mock('src/selectors', () => ({
    isCurrentUserAdmin: () => false,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRun = {
    id: 'run-1',
    name: 'Test Run',
    summary: '',
    summary_modified_at: 0,
    owner_user_id: 'user-1',
    reporter_user_id: 'user-1',
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
    status_update_enabled: false,
    broadcast_channel_ids: [],
    status_update_broadcast_webhooks_enabled: false,
    webhook_on_status_update_urls: [],
    status_update_broadcast_channels_enabled: false,
    previous_reminder: 0,
    timeline_events: [],
    retrospective: '',
    retrospective_published_at: 0,
    retrospective_was_canceled: false,
    retrospective_reminder_interval_seconds: 0,
    retrospective_enabled: false,
    participant_ids: [],
    metrics_data: [],
    create_channel_member_on_new_participant: false,
    remove_channel_member_on_removed_participant: false,
    items_order: [],
    type: PlaybookRunType.Playbook,
    run_number: 0,
    sequential_id: '',
    task_total: 0,
    task_completed: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FinishRun component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the finish section when the run is in progress', () => {
        const component = renderer.create(<FinishRun playbookRun={baseRun}/>);
        const json = JSON.stringify(component.toJSON());
        expect(json).toContain('run-finish-section');
    });

    it('returns null when the run is already finished', () => {
        const finishedRun = {...baseRun, current_status: RunStatus.Finished};
        const component = renderer.create(<FinishRun playbookRun={finishedRun}/>);
        expect(component.toJSON()).toBeNull();
    });

    it('returns null when ownerGroupOnlyActions is true and the user is not the owner', () => {
        const component = renderer.create(
            <FinishRun
                playbookRun={baseRun}
                ownerGroupOnlyActions={true}
                isOwner={false}
            />,
        );
        expect(component.toJSON()).toBeNull();
    });

    it('renders when ownerGroupOnlyActions is true and the user is the owner', () => {
        const component = renderer.create(
            <FinishRun
                playbookRun={baseRun}
                ownerGroupOnlyActions={true}
                isOwner={true}
            />,
        );
        const json = JSON.stringify(component.toJSON());
        expect(json).toContain('run-finish-section');
    });

    it('dispatches openModal when the finish button is clicked', () => {
        const component = renderer.create(<FinishRun playbookRun={baseRun}/>);
        const tree = component.toJSON() as any;

        // Find the finish button by drilling into the rendered tree
        const findButton = (node: any): any => {
            if (!node) {
                return null;
            }
            if (Array.isArray(node)) {
                for (const child of node) {
                    const found = findButton(child);
                    if (found) {
                        return found;
                    }
                }
                return null;
            }
            if (node.props?.['data-testid'] === 'finish-run-button') {
                return node;
            }
            if (node.children) {
                return findButton(node.children);
            }
            return null;
        };

        const btn = findButton(tree);
        expect(btn).not.toBeNull();

        act(() => {
            btn.props.onClick();
        });

        // dispatch is called with the return value of modals.openModal(...)
        expect(mockDispatch).toHaveBeenCalledTimes(1);

        // modals.openModal was called with the modal definition produced by makeUncontrolledConfirmModalDefinition
        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        const modalArg = mockOpenModal.mock.calls[0][0];
        expect(modalArg).toEqual({type: 'CONFIRM_MODAL', props: expect.objectContaining({show: true})});
    });
});

describe('useOnFinishRun — error handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls finishRun and refreshes LHS on success (backstage location)', async () => {
        mockFinishRun.mockResolvedValue(undefined);

        // Capture the onConfirm callback that gets passed to openModal
        let capturedOnConfirm: (() => Promise<void>) | null = null;
        mockOpenModal.mockImplementation((action: any) => {
            capturedOnConfirm = action?.props?.onConfirm ?? null;
            return {type: 'OPEN_MODAL'};
        });

        // Render a thin wrapper that calls useOnFinishRun
        const Wrapper = () => {
            const onFinishRun = useOnFinishRun(baseRun, 'backstage');
            return (
                <button
                    data-testid='trigger'
                    onClick={onFinishRun}
                />
            );
        };

        const component = renderer.create(<Wrapper/>);
        const tree = component.toJSON() as any;

        act(() => {
            tree.props.onClick();
        });

        expect(mockDispatch).toHaveBeenCalledTimes(1);
        expect(capturedOnConfirm).not.toBeNull();

        // Execute the confirmation callback
        await act(async () => {
            await capturedOnConfirm!();
        });

        expect(mockFinishRun).toHaveBeenCalledWith('run-1');
        expect(mockRefreshLHS).toHaveBeenCalledTimes(1);
    });

    it('shows error toast when finishRun returns an error', async () => {
        const testError = new Error('server error');
        mockFinishRun.mockResolvedValue({error: testError});

        let capturedOnConfirm: (() => Promise<void>) | null = null;
        mockOpenModal.mockImplementation((action: any) => {
            capturedOnConfirm = action?.props?.onConfirm ?? null;
            return {type: 'OPEN_MODAL'};
        });

        const Wrapper = () => {
            const onFinishRun = useOnFinishRun(baseRun, 'backstage');
            return (
                <button
                    data-testid='trigger'
                    onClick={onFinishRun}
                />
            );
        };

        const component = renderer.create(<Wrapper/>);
        const tree = component.toJSON() as any;

        act(() => {
            tree.props.onClick();
        });

        expect(capturedOnConfirm).not.toBeNull();

        await act(async () => {
            await capturedOnConfirm!();
        });

        expect(mockFinishRun).toHaveBeenCalledWith('run-1');

        // Refresh LHS should NOT be called when there is an error
        expect(mockRefreshLHS).not.toHaveBeenCalled();
    });

    it('does not call refreshLHS when location is not backstage', async () => {
        mockFinishRun.mockResolvedValue(undefined);

        let capturedOnConfirm: (() => Promise<void>) | null = null;
        mockOpenModal.mockImplementation((action: any) => {
            capturedOnConfirm = action?.props?.onConfirm ?? null;
            return {type: 'OPEN_MODAL'};
        });

        const Wrapper = () => {
            const onFinishRun = useOnFinishRun(baseRun, 'rhs');
            return (
                <button
                    data-testid='trigger'
                    onClick={onFinishRun}
                />
            );
        };

        const component = renderer.create(<Wrapper/>);
        const tree = component.toJSON() as any;

        act(() => {
            tree.props.onClick();
        });

        await act(async () => {
            await capturedOnConfirm!();
        });

        expect(mockFinishRun).toHaveBeenCalledWith('run-1');
        expect(mockRefreshLHS).not.toHaveBeenCalled();
    });
});

describe('useFinishRunConfirmationMessage', () => {
    it('returns a confirmation message without outstanding tasks', () => {
        const Wrapper = () => {
            const msg = useFinishRunConfirmationMessage({name: 'My Run', checklists: []});
            return <span data-testid='msg'>{msg}</span>;
        };

        const component = renderer.create(<Wrapper/>);
        const json = JSON.stringify(component.toJSON());
        expect(json).toContain('My Run');
        expect(json).toContain('finish');
    });

    it('includes outstanding task count when tasks are open', () => {
        // ChecklistItemState.Open === '' (empty string)
        const runWithTasks = {
            name: 'My Run',
            checklists: [
                {
                    items: [
                        {state: ''},
                        {state: ''},
                    ],
                },
            ],
        };

        const Wrapper = () => {
            const msg = useFinishRunConfirmationMessage(runWithTasks as any);
            return <span data-testid='msg'>{msg}</span>;
        };

        const component = renderer.create(<Wrapper/>);
        const json = JSON.stringify(component.toJSON());
        expect(json).toContain('2');
        expect(json).toContain('outstanding');
    });
});
