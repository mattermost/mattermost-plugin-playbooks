// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import {navigateToPluginUrl} from 'src/browser_routing';
import {ButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {ChecklistParent} from 'src/components/rhs/rhs_checklist_list';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {ChecklistItemState} from 'src/types/playbook';

import EmbeddedChecklist from './embedded_checklist';
import {isChannelEmbedded, resetEmbeddedRegistry} from './embedded_run_registry';
import {useEmbeddedRun} from './use_embedded_run';

jest.mock('./use_embedded_run', () => ({
    useEmbeddedRun: jest.fn(),
}));

jest.mock('src/browser_routing', () => ({
    navigateToPluginUrl: jest.fn(),
}));

jest.mock('@apollo/client', () => ({
    ApolloProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('src/graphql_client', () => ({
    getPlaybooksGraphQLClient: jest.fn(() => ({})),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    ToastProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
    useToaster: () => ({add: jest.fn(() => 1), remove: jest.fn()}),
}));

jest.mock('src/components/assets/loading_spinner', () => ({
    __esModule: true,
    default: () => <span data-testid='spinner'/>,
}));

jest.mock('src/hooks/redux', () => ({
    useAppSelector: () => 'user_1',
}));

let mockCanModify = true;
jest.mock('src/hooks/run_permissions', () => ({
    useCanModifyRun: () => mockCanModify,
}));

jest.mock('src/hooks', () => ({
    useParticipateInRun: () => ({
        ParticipateConfirmModal: <div data-testid='participate-modal'/>,
        showParticipateConfirm: jest.fn(),
    }),
}));

const mockChecklistList = jest.fn();
jest.mock('src/components/rhs/rhs_checklist_list', () => ({
    __esModule: true,
    ChecklistParent: {RHS: 'rhs', RunDetails: 'run_details', Embedded: 'embedded'},
    default: (props: unknown) => {
        mockChecklistList(props);
        return <div data-testid='checklist-list'/>;
    },
}));

jest.mock('src/components/checklist_item/checklist_item', () => ({
    ButtonsFormat: {Long: 'long', Mixed: 'mixed', Short: 'short'},
}));

const mockUseEmbeddedRun = useEmbeddedRun as jest.Mock;

const makeRun = (overrides: Partial<PlaybookRun> = {}): PlaybookRun => ({
    id: 'run_1',
    name: 'Launch checklist',
    channel_id: 'channel_1',
    team_id: 'team_1',
    owner_user_id: 'user_1',
    participant_ids: ['user_1'],
    type: PlaybookRunType.ChannelChecklist,
    current_status: PlaybookRunStatus.InProgress,
    checklists: [{
        id: 'c1',
        title: 'Tasks',
        items: [
            {title: 'a', state: ChecklistItemState.Closed},
            {title: 'b', state: ChecklistItemState.Open},
        ],
    }],
    ...overrides,
} as unknown as PlaybookRun);

const renderEmbed = (props: Partial<React.ComponentProps<typeof EmbeddedChecklist>> = {}) => render(
    <IntlProvider locale='en'>
        <EmbeddedChecklist
            runId='run_1'
            {...props}
        />
    </IntlProvider>,
);

const lastListProps = () => mockChecklistList.mock.calls[mockChecklistList.mock.calls.length - 1][0];

describe('EmbeddedChecklist', () => {
    beforeEach(() => {
        mockCanModify = true;
        mockChecklistList.mockClear();
        mockUseEmbeddedRun.mockReset();
        (navigateToPluginUrl as jest.Mock).mockReset();
        resetEmbeddedRegistry();
        mockUseEmbeddedRun.mockReturnValue({run: makeRun(), status: 'ready', retry: jest.fn()});
    });

    it('renders nothing without a run id', () => {
        mockUseEmbeddedRun.mockReturnValue({run: undefined, status: 'loading', retry: jest.fn()});
        const {container} = renderEmbed({runId: ''});

        expect(container.innerHTML).toBe('');
    });

    it('shows a spinner while loading', () => {
        mockUseEmbeddedRun.mockReturnValue({run: undefined, status: 'loading', retry: jest.fn()});
        renderEmbed();

        expect(screen.getByTestId('spinner')).toBeTruthy();
        expect(screen.queryByTestId('checklist-list')).toBeNull();
    });

    it('shows the unavailable state without a link', () => {
        mockUseEmbeddedRun.mockReturnValue({run: undefined, status: 'unavailable', retry: jest.fn()});
        renderEmbed();

        expect(screen.getByTestId('embedded-checklist-unavailable')).toBeTruthy();
        expect(screen.queryByTestId('embedded-checklist-open')).toBeNull();
    });

    it('shows the error state and retries', () => {
        const retry = jest.fn();
        mockUseEmbeddedRun.mockReturnValue({run: undefined, status: 'error', retry});
        renderEmbed();

        fireEvent.click(screen.getByTestId('embedded-checklist-retry'));

        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('renders the header and the checklist when ready', () => {
        renderEmbed();

        expect(screen.getByTestId('embedded-checklist-count').textContent).toBe('1/2 done');
        expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
        expect(screen.queryByTestId('embedded-checklist-finished')).toBeNull();
        expect(lastListProps()).toMatchObject({
            parentContainer: ChecklistParent.Embedded,
            readOnly: false,
            playbookRun: expect.objectContaining({id: 'run_1'}),
        });
    });

    it('shows the finished badge for a finished run', () => {
        mockUseEmbeddedRun.mockReturnValue({
            run: makeRun({current_status: PlaybookRunStatus.Finished}),
            status: 'ready',
            retry: jest.fn(),
        });
        renderEmbed();

        expect(screen.getByTestId('embedded-checklist-finished')).toBeTruthy();
    });

    it('treats a run in another channel as unavailable', () => {
        renderEmbed({channelId: 'other_channel'});

        expect(screen.getByTestId('embedded-checklist-unavailable')).toBeTruthy();
        expect(screen.queryByTestId('checklist-list')).toBeNull();
        expect(isChannelEmbedded('channel_1')).toBe(false);
    });

    it('accepts a matching channel id', () => {
        renderEmbed({channelId: 'channel_1'});

        expect(screen.getByTestId('checklist-list')).toBeTruthy();
    });

    it('is read-only when the user cannot modify the run', () => {
        mockCanModify = false;
        renderEmbed({compact: false});

        expect(lastListProps()).toMatchObject({readOnly: true, buttonsFormat: ButtonsFormat.Mixed});
    });

    describe('read-only interaction prompt', () => {
        it('is offered for in-progress playbook runs', () => {
            mockUseEmbeddedRun.mockReturnValue({
                run: makeRun({type: PlaybookRunType.Playbook}),
                status: 'ready',
                retry: jest.fn(),
            });
            renderEmbed();

            expect(lastListProps().onReadOnlyInteract).toEqual(expect.any(Function));
            expect(screen.getByTestId('participate-modal')).toBeTruthy();
        });

        it('is not offered for channel checklists', () => {
            renderEmbed();

            expect(lastListProps().onReadOnlyInteract).toBeUndefined();
            expect(screen.queryByTestId('participate-modal')).toBeNull();
        });

        it('is not offered for finished playbook runs', () => {
            mockUseEmbeddedRun.mockReturnValue({
                run: makeRun({type: PlaybookRunType.Playbook, current_status: PlaybookRunStatus.Finished}),
                status: 'ready',
                retry: jest.fn(),
            });
            renderEmbed();

            expect(lastListProps().onReadOnlyInteract).toBeUndefined();
        });
    });

    describe('open in Playbooks', () => {
        it('navigates to the run by default', () => {
            renderEmbed();

            fireEvent.click(screen.getByTestId('embedded-checklist-open'));

            expect(navigateToPluginUrl).toHaveBeenCalledWith('/runs/run_1');
        });

        it('calls the host handler instead when provided', () => {
            const onOpenInPlaybooks = jest.fn();
            renderEmbed({onOpenInPlaybooks});

            fireEvent.click(screen.getByTestId('embedded-checklist-open'));

            expect(onOpenInPlaybooks).toHaveBeenCalledTimes(1);
            expect(navigateToPluginUrl).not.toHaveBeenCalled();
        });
    });

    describe('compact layout', () => {
        it('uses the short format when compact is true', () => {
            renderEmbed({compact: true});

            expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Short);
            expect(screen.getByTestId('embedded-checklist').getAttribute('data-compact')).toBe('true');
        });

        it('uses the long format when compact is false', () => {
            renderEmbed({compact: false});

            expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Long);
        });

        describe('measured', () => {
            const originalResizeObserver = global.ResizeObserver;
            let callback: ResizeObserverCallback;
            let disconnect: jest.Mock;
            let width = 0;
            const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect');

            beforeEach(() => {
                disconnect = jest.fn();
                global.ResizeObserver = jest.fn((cb: ResizeObserverCallback) => {
                    callback = cb;
                    return {observe: jest.fn(), unobserve: jest.fn(), disconnect};
                }) as unknown as typeof ResizeObserver;
                rectSpy.mockImplementation(() => ({width} as DOMRect));
            });

            afterAll(() => {
                global.ResizeObserver = originalResizeObserver;
                rectSpy.mockRestore();
            });

            const resize = (next: number) => act(() => {
                callback([{contentRect: {width: next}} as ResizeObserverEntry], {} as ResizeObserver);
            });

            it('is compact below 600px and wide from 600px, following resizes', () => {
                width = 360;
                renderEmbed();
                expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Short);

                resize(900);
                expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Long);
                expect(screen.getByTestId('embedded-checklist').getAttribute('data-compact')).toBe('false');

                resize(599);
                expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Short);

                resize(600);
                expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Long);
            });

            it('starts wide in a wide container', () => {
                width = 900;
                renderEmbed();

                expect(lastListProps().buttonsFormat).toBe(ButtonsFormat.Long);
            });

            it('stops observing on unmount', () => {
                width = 900;
                const {unmount} = renderEmbed();

                unmount();

                expect(disconnect).toHaveBeenCalled();
            });

            it('does not observe when compact is set explicitly', () => {
                renderEmbed({compact: true});

                expect(global.ResizeObserver).not.toHaveBeenCalled();
            });
        });
    });

    describe('auto-open suppression', () => {
        it('suppresses the run channel while mounted and releases on unmount', () => {
            const {unmount} = renderEmbed();
            expect(isChannelEmbedded('channel_1')).toBe(true);

            unmount();

            expect(isChannelEmbedded('channel_1')).toBe(false);
        });

        it('does not suppress while the run is not loaded', () => {
            mockUseEmbeddedRun.mockReturnValue({run: undefined, status: 'loading', retry: jest.fn()});
            renderEmbed();

            expect(isChannelEmbedded('channel_1')).toBe(false);
        });
    });

    describe('error boundary', () => {
        it('shows a fallback with an open link when rendering throws', () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            mockChecklistList.mockImplementation(() => {
                throw new Error('boom');
            });
            renderEmbed();

            expect(screen.getByTestId('embedded-checklist-crashed')).toBeTruthy();
            expect(screen.queryByTestId('checklist-list')).toBeNull();

            fireEvent.click(screen.getByRole('button', {name: 'Open in Playbooks'}));
            expect(navigateToPluginUrl).toHaveBeenCalledWith('/runs/run_1');
            consoleError.mockRestore();
            mockChecklistList.mockReset();
        });
    });
});
