// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {ReactTestRendererJSON} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType, RunStatus} from 'src/graphql/generated/graphql';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import {FinishRunMenuItem, RestoreRunMenuItem, ToggleRunRetrospectiveMenuItem} from './controls';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Prevent mattermost-redux selector initialization errors triggered by the
// transitive import chain: controls.tsx → src/client → mattermost-redux selectors.
jest.mock('src/client', () => ({
    exportChannelUrl: jest.fn(),
    getSiteUrl: jest.fn(() => ''),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(() => 'current-user-id'),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeamId: jest.fn(() => 'team-1'),
}));

jest.mock('react-redux', () => ({
    useDispatch: Object.assign(() => jest.fn(), {withTypes: () => () => jest.fn()}),
    useSelector: Object.assign(() => 'current-user-id', {withTypes: () => () => 'current-user-id'}),
}));

jest.mock('src/hooks', () => ({
    useAllowChannelExport: jest.fn(() => true),
    useExportLogAvailable: jest.fn(() => false),
    usePlaybooksRouting: jest.fn(() => ({})),
}));

jest.mock('src/types/playbook_run', () => ({
    playbookRunIsActive: (run: any) => run.current_status === 'InProgress',
}));

jest.mock('src/types/playbook', () => ({
    ChecklistItemState: {Open: ''},
    newChecklistItem: jest.fn(),
}));

jest.mock('src/utils', () => ({
    copyToClipboard: jest.fn(),
}));

jest.mock('./enable_disable_run_status_update', () => ({
    useToggleRunStatusUpdate: jest.fn(() => jest.fn()),
}));

jest.mock('./enable_disable_retrospective', () => ({
    useToggleRunRetrospective: () => jest.fn(),
}));

// Capture props so assertions can inspect disabled / disabledAltText without
// needing to render the full styled-component + tooltip tree.
// Also render children so nested testid lookups work.
let lastDropdownItemProps: Record<string, unknown> = {};
jest.mock('src/components/backstage/shared', () => ({
    StyledDropdownMenuItem: (props: Record<string, unknown>) => {
        lastDropdownItemProps = props;
        const {children, disabled, disabledAltText, ...rest} = props;
        return (
            <div
                data-testid='dropdown-item'
                data-disabled={String(disabled)}
                data-disabled-text={disabledAltText ?? ''}
                {...rest}
            >
                {children as React.ReactNode}
            </div>
        );
    },
    StyledDropdownMenuItemRed: ({children, ...props}: React.PropsWithChildren<Record<string, unknown>>) => (
        <div {...props}>{children}</div>
    ),
}));

jest.mock('src/components/backstage/playbook_runs/shared', () => ({
    Separator: () => null,
    Role: {Participant: 'participant', Viewer: 'viewer'},
}));

const mockIsBlockedByOwnerOnly = jest.fn<boolean, [boolean, boolean]>(() => false);
jest.mock('src/hooks/permissions', () => ({
    useIsBlockedByOwnerOnlyForFinishRestore: (a: boolean, b: boolean) => mockIsBlockedByOwnerOnly(a, b),
    useIsSystemAdmin: () => false,
}));

jest.mock('src/hooks/run_permissions', () => ({
    useCanModifyRun: jest.fn(() => true),
    useCanRestoreRun: jest.fn(() => true),
    useCanToggleRunRetrospective: jest.fn(() => true),
}));

const useCanModifyRunMock = jest.mocked(jest.requireMock('src/hooks/run_permissions').useCanModifyRun);
const useCanToggleRunRetrospectiveMock = jest.mocked(jest.requireMock('src/hooks/run_permissions').useCanToggleRunRetrospective);

jest.mock('src/hooks/redux', () => ({
    useAppSelector: () => 'current-user-id',
}));

jest.mock('./finish_run', () => ({
    useOnFinishRun: () => jest.fn(),
}));

jest.mock('./restore_run', () => ({
    useOnRestoreRun: () => jest.fn(),
}));

// babel-plugin-formatjs with ast:true pre-compiles defaultMessage strings into
// [{type: 0, value: '...'}] AST arrays. Extract the literal text from that.
const extractMsg = (msg: unknown): string => {
    if (typeof msg === 'string') {
        return msg;
    }
    if (Array.isArray(msg)) {
        return msg
            .filter((el: {type: number}) => el.type === 0)
            .map((el: {value: string}) => el.value)
            .join('');
    }
    return String(msg);
};

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {
        ...reactIntl,
        useIntl: () => ({
            formatMessage: ({defaultMessage}: {defaultMessage: unknown}) => extractMsg(defaultMessage),
        }),
        FormattedMessage: ({defaultMessage}: {defaultMessage: unknown}) => <span>{extractMsg(defaultMessage)}</span>,
    };
});

jest.mock('@mattermost/compass-icons/components', () => ({
    ArrowDownIcon: () => null,
    BookOutlineIcon: () => null,
    BullhornOutlineIcon: () => null,
    CloseIcon: () => null,
    FlagOutlineIcon: () => null,
    LightningBoltOutlineIcon: () => null,
    LinkVariantIcon: () => null,
    PencilOutlineIcon: () => null,
    StarIcon: () => null,
    StarOutlineIcon: () => null,
    UpdateIcon: () => null,
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const activeRun = {
    id: 'run-1',
    name: 'Test Run',
    owner_user_id: 'owner-id',
    team_id: 'team-1',
    channel_id: 'channel-1',
    type: 'playbook',
    participant_ids: ['current-user-id', 'owner-id'],
    current_status: RunStatus.InProgress,
    end_at: 0,
} as any;

const finishedRun = {
    ...activeRun,
    current_status: RunStatus.Finished,
    end_at: Date.now(),
};

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
    run_number: 0,
    sequential_id: '',
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

beforeEach(() => {
    lastDropdownItemProps = {};
    useCanModifyRunMock.mockReturnValue(true);
    useCanToggleRunRetrospectiveMock.mockReturnValue(true);
    jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — FinishRunMenuItem tooltip text
// ---------------------------------------------------------------------------

describe('FinishRunMenuItem — disabledAltText', () => {
    it('passes disabledAltText when the user is blocked by owner-only restriction', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(true);

        renderer.create(
            <FinishRunMenuItem
                playbookRun={activeRun}
                role={Role.Participant}
                ownerGroupOnlyActions={true}
                isOwner={false}
            />,
        );

        expect(lastDropdownItemProps.disabled).toBe(true);
        expect(lastDropdownItemProps.disabledAltText).toBe('Only the run owner can finish this run');
    });

    it('passes no disabledAltText when the user is not blocked', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(false);

        renderer.create(
            <FinishRunMenuItem
                playbookRun={activeRun}
                role={Role.Participant}
                ownerGroupOnlyActions={false}
                isOwner={true}
            />,
        );

        expect(lastDropdownItemProps.disabled).toBeFalsy();
        expect(lastDropdownItemProps.disabledAltText).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Tests — RestoreRunMenuItem tooltip text
// ---------------------------------------------------------------------------

describe('RestoreRunMenuItem — disabledAltText', () => {
    it('passes disabledAltText when the user is blocked by owner-only restriction', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(true);

        renderer.create(
            <RestoreRunMenuItem
                playbookRun={finishedRun}
                role={Role.Participant}
                ownerGroupOnlyActions={true}
                isOwner={false}
            />,
        );

        expect(lastDropdownItemProps.disabled).toBe(true);
        expect(lastDropdownItemProps.disabledAltText).toBe('Only the run owner can restart this run');
    });

    it('passes no disabledAltText when the user is not blocked', () => {
        mockIsBlockedByOwnerOnly.mockReturnValue(false);

        renderer.create(
            <RestoreRunMenuItem
                playbookRun={finishedRun}
                role={Role.Participant}
                ownerGroupOnlyActions={false}
                isOwner={true}
            />,
        );

        expect(lastDropdownItemProps.disabled).toBeFalsy();
        expect(lastDropdownItemProps.disabledAltText).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Tests — ToggleRunRetrospectiveMenuItem
// ---------------------------------------------------------------------------

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
