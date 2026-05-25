// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import {RunStatus} from 'src/graphql/generated/graphql';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import {FinishRunMenuItem, RestoreRunMenuItem} from './controls';

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

// Capture props so assertions can inspect disabled / disabledAltText without
// needing to render the full styled-component + tooltip tree.
let lastDropdownItemProps: Record<string, unknown> = {};
jest.mock('src/components/backstage/shared', () => ({
    StyledDropdownMenuItem: (props: Record<string, unknown>) => {
        lastDropdownItemProps = props;
        return (
            <div
                data-testid='dropdown-item'
                data-disabled={String(props.disabled)}
                data-disabled-text={props.disabledAltText ?? ''}
            />
        );
    },
    StyledDropdownMenuItemRed: () => null,
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
    useCanModifyRun: () => true,
    useCanRestoreRun: () => true,
}));

jest.mock('src/hooks/redux', () => ({
    useAppSelector: () => 'current-user-id',
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: () => 'current-user-id',
}));

jest.mock('./finish_run', () => ({
    useOnFinishRun: () => jest.fn(),
}));

jest.mock('./restore_run', () => ({
    useOnRestoreRun: () => jest.fn(),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en', defaultLocale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
        FormattedMessage: ({defaultMessage}: {defaultMessage: string}) => <span>{defaultMessage}</span>,
    };
});

jest.mock('@mattermost/compass-icons/components', () => ({
    FlagOutlineIcon: () => null,
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

// ---------------------------------------------------------------------------
// Tests — FinishRunMenuItem tooltip text
// ---------------------------------------------------------------------------

describe('FinishRunMenuItem — disabledAltText', () => {
    beforeEach(() => {
        lastDropdownItemProps = {};
        jest.clearAllMocks();
    });

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
    beforeEach(() => {
        lastDropdownItemProps = {};
        jest.clearAllMocks();
    });

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
