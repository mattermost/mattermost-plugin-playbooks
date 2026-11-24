// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tests for the admin_only_edit-aware canEdit logic in PlaybookListRow:
// - Edit vs View label in the dot-menu
// - Archive disabled/enabled based on canEdit

import React from 'react';
import renderer from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import {PlaybookRole} from 'src/types/permissions';

// ── Selector mocks ─────────────────────────────────────────────────────────
const mockTeam = {id: 'team-1', name: 'team1', display_name: 'Team 1'};
const mockCurrentUser = {id: 'user-1', username: 'user1'};
const mockSelectors = {isAdmin: false};

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getTeam: () => mockTeam,
}));
jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUser: () => mockCurrentUser,
}));
jest.mock('src/selectors', () => ({
    isCurrentUserAdmin: () => mockSelectors.isAdmin,
}));
jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: (selector: any) => selector({}),
}));

// ── Other hook/util mocks ──────────────────────────────────────────────────
jest.mock('src/hooks', () => ({
    useHasPlaybookPermission: () => true,
    useHasTeamPermission: () => true,
}));
jest.mock('src/graphql/hooks', () => ({
    usePlaybookMembership: () => ({join: jest.fn(), leave: jest.fn()}),
}));
jest.mock('src/client', () => ({
    createPlaybookRun: jest.fn(),
    playbookExportProps: () => ['#', 'export.json'],
}));
jest.mock('src/browser_routing', () => ({
    navigateToPluginUrl: jest.fn(),
    navigateToUrl: jest.fn(),
}));
jest.mock('src/actions', () => ({openPlaybookRunModal: jest.fn()}));
jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => jest.fn(),
}));
jest.mock('src/components/backstage/playbook_editor/controls', () => ({
    playbookIsTutorialPlaybook: () => false,
}));
jest.mock('src/webapp_globals', () => ({Timestamp: () => null}));
jest.mock('src/components/widgets/text_with_tooltip', () => ({
    __esModule: true,
    default: ({text}: {text: string}) => <span>{text}</span>,
}));

// Blanket mock so styled-components doesn't receive undefined for any icon
jest.mock('@mattermost/compass-icons/components', () =>
    new Proxy({}, {get: () => () => null}),
);
jest.mock('src/components/assets/buttons', () => ({
    SecondaryButton: ({children}: any) => <button>{children}</button>,
    TertiaryButton: ({children}: any) => <button>{children}</button>,
}));
jest.mock('mattermost-redux/client', () => ({Client4: {getChannel: jest.fn()}}));

// ── DotMenu mock: renders children always; captures disabled state ──────────
jest.mock('src/components/dot_menu', () => {
    const {createElement} = jest.requireActual<typeof import('react')>('react');
    return {
        __esModule: true,
        default: ({children}: {children: unknown}) => createElement('div', {'data-testid': 'dot-menu'}, children as any),
        DotMenuButton: () => null,
        DropdownMenuItem: ({children, disabled}: {children: unknown; disabled?: boolean}) =>
            createElement('div', {'data-disabled': disabled ? 'true' : 'false'}, children as any),
        DropdownMenuItemStyled: ({children}: {children: unknown}) =>
            createElement('div', null, children as any),
        iconSplitStyling: '',
    };
});

// ── Styles mock ────────────────────────────────────────────────────────────
jest.mock('./styles', () => ({InfoLine: ({children}: any) => <span>{children}</span>}));

import PlaybookListRow from './playbook_list_row';

// ── Helpers ────────────────────────────────────────────────────────────────
const containsText = (node: any, text: string): boolean => {
    if (typeof node === 'string') {
        return node === text;
    }
    if (Array.isArray(node)) {
        return node.some((c: any) => containsText(c, text));
    }
    if (node?.children) {
        return node.children.some((c: any) => containsText(c, text));
    }
    return false;
};

const findAll = (node: any, pred: (n: any) => boolean): any[] => {
    if (!node || typeof node === 'string') {
        return [];
    }
    const results: any[] = [];
    if (pred(node)) {
        results.push(node);
    }
    (Array.isArray(node) ? node : node.children ?? []).forEach((c: any) => results.push(...findAll(c, pred)));
    return results;
};

const hasText = (tree: any, text: string) =>
    findAll(tree, (n) => containsText(n, text)).length > 0;

const archiveIsDisabled = (tree: any): boolean => {
    const archiveItems = findAll(tree, (n) => n.props?.['data-disabled'] !== undefined && containsText(n, 'Archive'));
    return archiveItems.length > 0 && archiveItems[0].props['data-disabled'] === 'true';
};

const archiveIsEnabled = (tree: any): boolean => {
    const archiveItems = findAll(tree, (n) => n.props?.['data-disabled'] !== undefined && containsText(n, 'Archive'));
    return archiveItems.length > 0 && archiveItems[0].props['data-disabled'] === 'false';
};

// ── Playbook factory ───────────────────────────────────────────────────────
const makePlaybook = (adminOnlyEdit: boolean, memberRole: string | null, defaultPlaybookAdminRole?: string) => ({
    id: 'pb-1',
    title: 'Test Playbook',
    description: '',
    team_id: 'team-1',
    public: true,
    delete_at: 0,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    run_summary_template_enabled: false,
    default_owner_id: '',
    default_owner_enabled: false,
    active_runs: 0,
    default_playbook_member_role: '',
    default_playbook_admin_role: defaultPlaybookAdminRole,
    admin_only_edit: adminOnlyEdit,
    members: memberRole === null ? [] : [
        {
            user_id: 'user-1',
            roles: [],
            scheme_roles: [memberRole],
        },
    ],
});

const defaultProps = {
    onClick: jest.fn(),
    onEdit: jest.fn(),
    onArchive: jest.fn(),
    onRestore: jest.fn(),
    onDuplicate: jest.fn(),
    onMembershipChanged: jest.fn(),
};

const renderRow = (adminOnlyEdit: boolean, memberRole: string | null, defaultPlaybookAdminRole?: string) =>
    renderer.create(
        <IntlProvider locale='en'>
            <PlaybookListRow
                playbook={makePlaybook(adminOnlyEdit, memberRole, defaultPlaybookAdminRole) as any}
                {...defaultProps}
            />
        </IntlProvider>,
    ).toJSON();

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PlaybookListRow > Edit/View label', () => {
    beforeEach(() => {
        mockSelectors.isAdmin = false;
    });

    it('shows Edit when member and admin_only_edit=false', () => {
        const tree = renderRow(false, PlaybookRole.Member);
        expect(hasText(tree, 'Edit')).toBe(true);
        expect(hasText(tree, 'View')).toBe(false);
    });

    it('shows View when member and admin_only_edit=true (non-admin)', () => {
        const tree = renderRow(true, PlaybookRole.Member);
        expect(hasText(tree, 'View')).toBe(true);
        expect(hasText(tree, 'Edit')).toBe(false);
    });

    it('shows Edit when playbook admin and admin_only_edit=true', () => {
        const tree = renderRow(true, PlaybookRole.Admin);
        expect(hasText(tree, 'Edit')).toBe(true);
        expect(hasText(tree, 'View')).toBe(false);
    });

    it('shows Edit when system admin member and admin_only_edit=true', () => {
        mockSelectors.isAdmin = true;
        const tree = renderRow(true, PlaybookRole.Member);
        expect(hasText(tree, 'Edit')).toBe(true);
        expect(hasText(tree, 'View')).toBe(false);
    });
});

describe('PlaybookListRow > Archive disabled state', () => {
    beforeEach(() => {
        mockSelectors.isAdmin = false;
    });

    it('Archive is enabled when admin_only_edit=false', () => {
        const tree = renderRow(false, PlaybookRole.Member);
        expect(archiveIsEnabled(tree)).toBe(true);
    });

    it('Archive is disabled when member and admin_only_edit=true (non-admin)', () => {
        const tree = renderRow(true, PlaybookRole.Member);
        expect(archiveIsDisabled(tree)).toBe(true);
    });

    it('Archive is enabled when playbook admin and admin_only_edit=true', () => {
        const tree = renderRow(true, PlaybookRole.Admin);
        expect(archiveIsEnabled(tree)).toBe(true);
    });

    it('Archive is enabled when system admin and admin_only_edit=true', () => {
        mockSelectors.isAdmin = true;
        const tree = renderRow(true, PlaybookRole.Member);
        expect(archiveIsEnabled(tree)).toBe(true);
    });
});

describe('PlaybookListRow > default_playbook_admin_role', () => {
    beforeEach(() => {
        mockSelectors.isAdmin = false;
    });

    it('shows Edit when member holds the custom admin role', () => {
        const tree = renderRow(true, 'custom_admin_role', 'custom_admin_role');
        expect(hasText(tree, 'Edit')).toBe(true);
        expect(hasText(tree, 'View')).toBe(false);
    });

    it('shows View when member holds PlaybookRole.Admin but custom role is required', () => {
        const tree = renderRow(true, PlaybookRole.Admin, 'custom_admin_role');
        expect(hasText(tree, 'View')).toBe(true);
        expect(hasText(tree, 'Edit')).toBe(false);
    });

    it('Archive is enabled when member holds the custom admin role', () => {
        const tree = renderRow(true, 'custom_admin_role', 'custom_admin_role');
        expect(archiveIsEnabled(tree)).toBe(true);
    });

    it('Archive is disabled when member holds PlaybookRole.Admin but custom role is required', () => {
        const tree = renderRow(true, PlaybookRole.Admin, 'custom_admin_role');
        expect(archiveIsDisabled(tree)).toBe(true);
    });
});
