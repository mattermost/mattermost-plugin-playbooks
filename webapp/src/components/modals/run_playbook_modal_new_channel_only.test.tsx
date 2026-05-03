// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {usePlaybook} from 'src/graphql/hooks';
import {usePlaybook as useRestPlaybook} from 'src/hooks/crud';

import {RunPlaybookModal} from './run_playbook_modal';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    const extractText = (defaultMessage: any): string => {
        if (typeof defaultMessage === 'string') {
            return defaultMessage;
        }
        if (Array.isArray(defaultMessage)) {
            return defaultMessage.map((node: any) => (typeof node === 'object' && node !== null ? String(node.value ?? '') : String(node))).join('');
        }
        return '';
    };
    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage}: {defaultMessage: any}) => <span>{extractText(defaultMessage)}</span>,
    };
});

jest.mock('react-redux', () => {
    const selectorFn = jest.fn((selector: any) => {
        if (selector.name === 'getCurrentUserId' || String(selector).includes('getCurrentUserId')) {
            return 'user-1';
        }
        if (String(selector).includes('getCurrentChannelId')) {
            return 'channel-1';
        }
        return null;
    });
    return {
        useSelector: Object.assign(selectorFn, {withTypes: () => selectorFn}),
        useDispatch: Object.assign(() => jest.fn(), {withTypes: () => () => jest.fn()}),
    };
});

jest.mock('src/graphql/hooks', () => ({
    usePlaybook: jest.fn(),
}));

jest.mock('src/hooks/crud', () => ({
    usePlaybook: jest.fn(),
}));

jest.mock('src/client', () => ({
    createPlaybookRun: jest.fn(),
}));

jest.mock('src/actions', () => ({
    displayPlaybookCreateModal: jest.fn(() => ({type: 'DISPLAY_PLAYBOOK_CREATE_MODAL'})),
}));

jest.mock('src/hooks', () => ({
    useCanCreatePlaybooksInTeam: () => true,
    usePlaybookAttributes: jest.fn(() => null),
}));

jest.mock('src/hooks/general', () => ({
    useProfilesInTeam: () => [],
    useUserDisplayNameMap: () => ({}),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: () => 'user-1',
    getUser: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getCurrentChannelId: () => 'channel-1',
}));

jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    getTeammateNameDisplaySetting: () => 'username',
    isCollapsedThreadsEnabled: () => false,
}));

jest.mock('mattermost-redux/utils/user_utils', () => ({
    displayUsername: (user: any) => user?.username ?? '',
}));

jest.mock('src/components/profile/profile', () => ({
    __esModule: true,
    default: ({userId}: {userId: string}) => <span data-testid={`profile-${userId}`}/>,
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid={props['data-testid'] || 'profile-selector'}
            onClick={() => props.onSelectedChange?.({id: 'user-abc', username: 'jdoe'})}
        />
    ),
}));

jest.mock('src/components/widgets/generic_modal', () => ({
    __esModule: true,
    default: ({children, id}: {children: React.ReactNode; id: string}) => (
        <div
            data-testid='generic-modal'
            data-id={id}
        >{children}</div>
    ),
    InlineLabel: ({children}: {children: React.ReactNode}) => <div data-testid='inline-label'>{children}</div>,
    ModalSideheading: ({children}: {children: React.ReactNode}) => <span>{children}</span>,
}));

jest.mock('src/components/playbooks_selector', () => ({
    __esModule: true,
    default: () => <div data-testid='playbooks-selector'/>,
}));

jest.mock('src/components/widgets/tooltip', () => ({
    __esModule: true,
    default: ({children, content}: {children: React.ReactNode; content: string}) => (
        <div
            data-testid='tooltip'
            data-content={content}
        >{children}</div>
    ),
}));

jest.mock('src/components/backstage/playbook_edit/automation/channel_access', () => ({
    ButtonLabel: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
    StyledChannelSelector: () => <div data-testid='channel-selector'/>,
    VerticalSplit: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

jest.mock('src/components/backstage/styles', () => ({
    HorizontalSpacer: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
    RadioInput: (props: any) => (
        <input
            type='radio'
            {...props}
        />
    ),
    StyledSelect: (props: any) => (
        <select
            data-testid={props['data-testid']}
            onChange={(e: any) => {
                if (props.isMulti) {
                    const values = Array.from(e.target.selectedOptions || [], (opt: any) => ({value: opt.value}));
                    props.onChange?.(values);
                } else {
                    props.onChange?.(e.target.value ? {value: e.target.value} : null);
                }
            }}
        >
            <option value=''>{'Select...'}</option>
            {(props.options || []).map((opt: any) => (
                <option
                    key={opt.value}
                    value={opt.value}
                >{opt.label}</option>
            ))}
        </select>
    ),
}));

jest.mock('@apollo/client', () => ({
    ApolloProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('src/graphql_client', () => ({
    getPlaybooksGraphQLClient: () => ({}),
}));

const makePlaybookWithNewChannelOnly = (newChannelOnly: boolean) => ({
    id: 'playbook-1',
    title: 'Test Playbook',
    channel_mode: 'create_new_channel',
    channel_id: '',
    channel_name_template: 'Run - Test',
    run_summary_template: '',
    run_summary_template_enabled: false,
    create_public_playbook_run: false,
    default_owner_enabled: false,
    default_owner_id: '',
    team_id: 'team-1',
    new_channel_only: newChannelOnly,
    run_number_prefix: '',
    propertyFields: [],
});

const mockUsePlaybook = usePlaybook as jest.Mock;
const mockUseRestPlaybook = useRestPlaybook as jest.Mock;

describe('RunPlaybookModal - new_channel_only behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders both channel mode radios when new_channel_only is false', () => {
        const playbook = makePlaybookWithNewChannelOnly(false);
        mockUsePlaybook.mockReturnValue([playbook, {error: null, isFetching: false}]);
        mockUseRestPlaybook.mockReturnValue([playbook]);

        const onRunCreated = jest.fn();
        const component = renderer.create(
            <RunPlaybookModal
                playbookId='playbook-1'
                teamId='team-1'
                onRunCreated={onRunCreated}
            />,
        );

        const instance = component.root;

        // The current component uses data-testid to identify channel mode radios
        const linkExistingRadio = instance.findAll(
            (node) => node.props['data-testid'] === 'link-existing-channel-radio',
        );
        const createChannelRadio = instance.findAll(
            (node) => node.props['data-testid'] === 'create-channel-radio',
        );

        expect(linkExistingRadio.length).toBeGreaterThan(0);
        expect(createChannelRadio.length).toBeGreaterThan(0);

        // Neither radio should be disabled in default mode
        linkExistingRadio.forEach((radio) => {
            expect(radio.props.disabled).toBeFalsy();
        });
    });

    it('channel mode defaults to create_new_channel based on playbook config', () => {
        const playbook = makePlaybookWithNewChannelOnly(false);
        mockUsePlaybook.mockReturnValue([playbook, {error: null, isFetching: false}]);
        mockUseRestPlaybook.mockReturnValue([playbook]);

        const onRunCreated = jest.fn();
        const component = renderer.create(
            <RunPlaybookModal
                playbookId='playbook-1'
                teamId='team-1'
                onRunCreated={onRunCreated}
            />,
        );

        const instance = component.root;

        // "Create a run channel" radio should be checked (default from playbook.channel_mode)
        const createChannelRadio = instance.findAll(
            (node) => node.props['data-testid'] === 'create-channel-radio',
        );
        expect(createChannelRadio.length).toBeGreaterThan(0);
        expect(createChannelRadio[0].props.checked).toBe(true);
    });

    it('when new_channel_only is true: "Link to existing channel" radio is disabled', () => {
        const playbook = makePlaybookWithNewChannelOnly(true);
        mockUsePlaybook.mockReturnValue([playbook, {error: null, isFetching: false}]);
        mockUseRestPlaybook.mockReturnValue([playbook]);

        const onRunCreated = jest.fn();
        const component = renderer.create(
            <RunPlaybookModal
                playbookId='playbook-1'
                teamId='team-1'
                onRunCreated={onRunCreated}
            />,
        );

        const instance = component.root;
        const linkExistingRadio = instance.findAll(
            (node) => node.props['data-testid'] === 'link-existing-channel-radio',
        );

        expect(linkExistingRadio.length).toBeGreaterThan(0);
        expect(linkExistingRadio[0].props.disabled).toBe(true);
    });

    it('when new_channel_only is true: tooltip shows enforcement message', () => {
        const playbook = makePlaybookWithNewChannelOnly(true);
        mockUsePlaybook.mockReturnValue([playbook, {error: null, isFetching: false}]);
        mockUseRestPlaybook.mockReturnValue([playbook]);

        const onRunCreated = jest.fn();
        const component = renderer.create(
            <RunPlaybookModal
                playbookId='playbook-1'
                teamId='team-1'
                onRunCreated={onRunCreated}
            />,
        );

        const treeJson = JSON.stringify(component.toJSON());
        expect(treeJson).toContain('This playbook requires a new channel for each run');
    });

    it('when new_channel_only is true: channel selector is not rendered', () => {
        const playbook = makePlaybookWithNewChannelOnly(true);
        mockUsePlaybook.mockReturnValue([playbook, {error: null, isFetching: false}]);
        mockUseRestPlaybook.mockReturnValue([playbook]);

        const onRunCreated = jest.fn();
        const component = renderer.create(
            <RunPlaybookModal
                playbookId='playbook-1'
                teamId='team-1'
                onRunCreated={onRunCreated}
            />,
        );

        const instance = component.root;
        const channelSelector = instance.findAll(
            (node) => node.props['data-testid'] === 'channel-selector',
        );

        expect(channelSelector.length).toBe(0);
    });
});
