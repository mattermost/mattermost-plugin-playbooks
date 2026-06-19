// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer from 'react-test-renderer';

import {UpdateRunStatusModal} from './update_run_status_modal';

// ---------------------------------------------------------------------------
// Module mocks
//
// The modal pulls in Apollo, the datetime input, Redux and a number of
// presentational widgets. We only care about whether the "Also mark the run as
// finished" checkbox is rendered, so everything else is stubbed out and the
// footer (which holds the checkbox) is rendered verbatim by a GenericModal mock.
// ---------------------------------------------------------------------------

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    Link: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('@apollo/client', () => ({
    ApolloProvider: ({children}: {children: React.ReactNode}) => children,
    useQuery: () => ({
        data: {
            run: {
                id: 'run-1',
                name: 'Test Run',
                teamID: 'team-1',
                broadcastChannelIDs: [],
                statusUpdateBroadcastChannelsEnabled: false,
                checklists: [],
                followers: [],
                reminderMessageTemplate: '',
                statusPosts: [],
                previousReminder: 0,
                reminderTimerDefaultSeconds: 0,
            },
        },
    }),
}));

jest.mock('src/graphql/generated', () => ({
    graphql: (s: string) => s,
    getFragmentData: (_fragment: unknown, data: unknown) => data,
}));

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/users'),
    getCurrentUserId: () => 'current-user',
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/channels'),
    getChannel: () => undefined,
}));

const mockUseRun = jest.fn();
const mockUsePlaybook = jest.fn();
jest.mock('src/hooks/general', () => ({
    useRun: (...args: unknown[]) => mockUseRun(...args),
    useUserDisplayNameMap: () => ({}),
}));
jest.mock('src/hooks/crud', () => ({
    usePlaybook: (...args: unknown[]) => mockUsePlaybook(...args),
}));

const mockIsBlockedByOwnerOnly = jest.fn();
jest.mock('src/hooks/permissions', () => ({
    useIsBlockedByOwnerOnlyForFinishRestore: (...args: [boolean | undefined, boolean | undefined]) =>
        mockIsBlockedByOwnerOnly(...args),
}));

jest.mock('src/hooks', () => ({
    useFormattedUsernames: () => [],
    usePost: () => [undefined],
}));

jest.mock('src/components/datetime_input', () => ({
    Mode: {DurationValue: 0, DateTimeValue: 1},
    ms: () => 0,
    useMakeOption: () => () => ({value: {}}),
    useDateTimeInput: () => ({input: null, value: undefined}),
}));

jest.mock('src/components/markdown_textbox', () => () => null);
jest.mock('src/components/assets/icons/warning_icon', () => () => null);
jest.mock('src/components/widgets/unsaved_changes_modal', () => () => null);
jest.mock('src/components/backstage/route_leaving_guard', () => () => null);
jest.mock('src/components/widgets/tooltip', () => () => null);

jest.mock('src/components/backstage/runs_list/checkbox_input', () => ({testId}: {testId: string}) => (
    <div data-testid={testId}/>
));

jest.mock('src/components/backstage/playbook_runs/playbook_run/finish_run', () => ({
    useFinishRunConfirmationMessage: () => '',
}));

jest.mock('src/components/widgets/generic_modal', () => {
    const actual = jest.requireActual('src/components/widgets/generic_modal');
    const GenericModal = ({children, footer}: {children: React.ReactNode; footer?: React.ReactNode}) => (
        <div>
            <div data-testid='modal-body'>{children}</div>
            <div data-testid='modal-footer'>{footer}</div>
        </div>
    );
    return {
        ...actual,
        __esModule: true,
        default: GenericModal,
    };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const baseProps = {
    playbookRunId: 'run-1',
    channelId: 'channel-1',
    hasPermission: true,
};

const renderModal = () => renderer.create(<UpdateRunStatusModal {...baseProps}/>);

describe('UpdateRunStatusModal — finish checkbox gating', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseRun.mockReturnValue([{owner_user_id: 'owner-1', playbook_id: 'playbook-1'}]);
        mockUsePlaybook.mockReturnValue([{owner_group_only_actions: true}]);
    });

    it('hides the "mark as finished" checkbox when the user is blocked by the owner-only restriction', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(true);

        const json = JSON.stringify(renderModal().toJSON());

        expect(json).not.toContain('mark-run-as-finished');
    });

    it('shows the "mark as finished" checkbox when the user is not blocked', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(false);

        const json = JSON.stringify(renderModal().toJSON());

        expect(json).toContain('mark-run-as-finished');
    });

    it('derives ownerGroupOnlyActions and isOwner from the run and playbook for the restriction check', () => {
        mockUseRun.mockReturnValue([{owner_user_id: 'current-user', playbook_id: 'playbook-1'}]);
        mockUsePlaybook.mockReturnValue([{owner_group_only_actions: true}]);
        mockIsBlockedByOwnerOnly.mockReturnValue(false);

        renderModal();

        // ownerGroupOnlyActions = true (from playbook), isOwner = true (owner === current user)
        expect(mockIsBlockedByOwnerOnly).toHaveBeenCalledWith(true, true);
    });

    it('passes undefined ownerGroupOnlyActions while the playbook is still loading', () => {
        mockUsePlaybook.mockReturnValue([undefined]);
        mockIsBlockedByOwnerOnly.mockReturnValue(true);

        renderModal();

        expect(mockIsBlockedByOwnerOnly).toHaveBeenCalledWith(undefined, false);
    });

    it('treats a null playbook (run still loading) as not-yet-known so the checkbox stays hidden', () => {
        // useThing resolves usePlaybook(undefined) to null while the run loads — null must be
        // treated like undefined, otherwise a blocked user briefly sees the checkbox.
        mockUseRun.mockReturnValue([undefined]);
        mockUsePlaybook.mockReturnValue([null]);
        mockIsBlockedByOwnerOnly.mockReturnValue(true);

        renderModal();

        expect(mockIsBlockedByOwnerOnly).toHaveBeenCalledWith(undefined, false);
    });
});
