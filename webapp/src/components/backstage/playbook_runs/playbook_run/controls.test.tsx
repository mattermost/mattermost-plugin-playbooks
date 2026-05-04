// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import renderer, {ReactTestRendererJSON} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import {ToggleRunRetrospectiveMenuItem} from './controls';

jest.mock('react-redux', () => ({
    useDispatch: Object.assign(() => jest.fn(), {withTypes: () => () => jest.fn()}),
    useSelector: Object.assign(() => 'current-user-id', {withTypes: () => () => 'current-user-id'}),
}));

jest.mock('src/hooks/run_permissions', () => ({
    useCanModifyRun: jest.fn(() => true),
    useCanToggleRunRetrospective: jest.fn(() => true),
}));

const useCanModifyRunMock = jest.mocked(jest.requireMock('src/hooks/run_permissions').useCanModifyRun);
const useCanToggleRunRetrospectiveMock = jest.mocked(jest.requireMock('src/hooks/run_permissions').useCanToggleRunRetrospective);

beforeEach(() => {
    useCanModifyRunMock.mockReturnValue(true);
    useCanToggleRunRetrospectiveMock.mockReturnValue(true);
});

jest.mock('./enable_disable_retrospective', () => ({
    useToggleRunRetrospective: () => jest.fn(),
}));

// Suppress styled-components className warnings in tests
jest.mock('src/components/backstage/shared', () => ({
    StyledDropdownMenuItem: ({children, ...props}: React.PropsWithChildren<Record<string, unknown>>) => (
        <div {...props}>{children}</div>
    ),
    StyledDropdownMenuItemRed: ({children, ...props}: React.PropsWithChildren<Record<string, unknown>>) => (
        <div {...props}>{children}</div>
    ),
}));

jest.mock('src/components/backstage/playbook_runs/shared', () => ({
    Separator: () => <hr/>,
    Role: {},
}));

const makeRun = (overrides: Partial<PlaybookRun> = {}): PlaybookRun => ({
    id: 'run-1',
    name: 'Test Run',
    summary: '',
    summary_modified_at: 0,
    owner_user_id: 'current-user-id',
    reporter_user_id: 'current-user-id',
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
    participant_ids: ['current-user-id'],
    metrics_data: [],
    create_channel_member_on_new_participant: false,
    remove_channel_member_on_removed_participant: false,
    items_order: [],
    type: PlaybookRunType.Playbook,
    ...overrides,
});

// hasTestId performs a depth-first search of a react-test-renderer tree looking
// for a node whose data-testid prop matches testId.
function hasTestId(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null, testId: string): boolean {
    if (!node) {
        return false;
    }
    if (Array.isArray(node)) {
        return node.some((n) => hasTestId(n, testId));
    }
    if (node.props?.['data-testid'] === testId) {
        return true;
    }
    if (node.children) {
        return hasTestId(node.children as ReactTestRendererJSON[], testId);
    }
    return false;
}

const renderMenuItem = (run: PlaybookRun) =>
    renderer.create(
        <IntlProvider locale='en'>
            <ToggleRunRetrospectiveMenuItem playbookRun={run}/>
        </IntlProvider>,
    );

describe('ToggleRunRetrospectiveMenuItem', () => {
    it('renders data-testid="disable-retrospective-menu-item" when retrospective is enabled', () => {
        const run = makeRun({retrospective_enabled: true});
        const tree = renderMenuItem(run).toJSON();
        expect(hasTestId(tree, 'disable-retrospective-menu-item')).toBe(true);
        expect(hasTestId(tree, 'enable-retrospective-menu-item')).toBe(false);
    });

    it('renders data-testid="enable-retrospective-menu-item" when retrospective is disabled', () => {
        const run = makeRun({retrospective_enabled: false});
        const tree = renderMenuItem(run).toJSON();
        expect(hasTestId(tree, 'enable-retrospective-menu-item')).toBe(true);
        expect(hasTestId(tree, 'disable-retrospective-menu-item')).toBe(false);
    });

    it('renders "Disable retrospective" text when retrospective is enabled', () => {
        const run = makeRun({retrospective_enabled: true});
        const tree = renderMenuItem(run).toJSON();
        expect(JSON.stringify(tree)).toContain('Disable retrospective');
    });

    it('renders "Enable retrospective" text when retrospective is disabled', () => {
        const run = makeRun({retrospective_enabled: false});
        const tree = renderMenuItem(run).toJSON();
        expect(JSON.stringify(tree)).toContain('Enable retrospective');
    });

    it('renders nothing when the user cannot toggle the retrospective', () => {
        useCanToggleRunRetrospectiveMock.mockReturnValue(false);
        const run = makeRun({retrospective_enabled: true});
        const tree = renderMenuItem(run).toJSON();
        expect(tree).toBeNull();
    });
});
