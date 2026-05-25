// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tests for handleAdminOnlyEditChange: optimistic update, savePlaybook call, and rollback on failure.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {clientFetchPlaybook, savePlaybook} from 'src/client';
import {findNodeByTestId} from 'src/utils/test_helpers';

jest.mock('src/client', () => ({savePlaybook: jest.fn(), clientFetchPlaybook: jest.fn(), getSiteUrl: () => ''}));
jest.mock('src/graphql/hooks', () => ({useUpdatePlaybook: () => jest.fn()}));
jest.mock('src/hooks', () => ({useAllowRetrospectiveAccess: () => true}));
jest.mock('src/components/backstage/toast_banner', () => ({useToaster: () => ({add: jest.fn()})}));
jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {...reactIntl, useIntl: () => reactIntl.createIntl({locale: 'en'})};
});
jest.mock('src/components/markdown_edit', () => () => null);
jest.mock('src/components/checklist/checklist_list', () => () => null);
jest.mock('src/components/playbook_actions_modal', () => () => null);
jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({Toggle: () => null}));
jest.mock('./section', () => ({__esModule: true, default: ({children, headerRight}: {children: React.ReactNode; headerRight?: React.ReactNode}) => <>{headerRight}{children}</>}));
jest.mock('./scroll_nav', () => () => null);

type SectionStatusUpdatesProps = {canEdit?: boolean};
let statusUpdatesProps: SectionStatusUpdatesProps | null = null;
jest.mock('./section_status_updates', () => (props: SectionStatusUpdatesProps) => {
    statusUpdatesProps = props;
    return null;
});

type SectionRetrospectiveProps = {canEdit?: boolean};
let retrospectiveProps: SectionRetrospectiveProps | null = null;
jest.mock('./section_retrospective', () => (props: SectionRetrospectiveProps) => {
    retrospectiveProps = props;
    return null;
});

type SectionActionsProps = {canEdit?: boolean};
let actionsProps: SectionActionsProps | null = null;
jest.mock('./section_actions', () => (props: SectionActionsProps) => {
    actionsProps = props;
    return null;
});

type ToggleProps = {isChecked: boolean; onChange: (value: boolean) => void};
let toggleProps: ToggleProps | null = null;

jest.mock('./section_admin_settings', () => ({
    __esModule: true,
    default: (props: ToggleProps) => {
        toggleProps = props;
        return (
            <span
                data-testid='mock-toggle'
                data-value={String(props.isChecked)}
            />
        );
    },
}));

jest.mock('src/components/backstage/playbook_editor/admin_only_edit_toggle', () => ({
    __esModule: true,
    default: () => null,
}));

import Outline from './outline';

const mockSavePlaybook = savePlaybook as jest.MockedFunction<typeof savePlaybook>;
const mockClientFetchPlaybook = clientFetchPlaybook as jest.MockedFunction<typeof clientFetchPlaybook>;

const makeFullPlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'pb-id',
    delete_at: 0,
    status_update_enabled: false,
    retrospective_enabled: false,
    run_summary_template_enabled: false,
    run_summary_template: '',
    ...overrides,
});

const renderOutline = (
    adminOnlyEdit: boolean,
    archived = false,
    {showAdminSettings = true}: {showAdminSettings?: boolean} = {},
) =>
    renderer.create(
        <Outline
            playbook={makeFullPlaybook({delete_at: archived ? 1 : 0}) as any}
            refetch={jest.fn()}
            canEdit={true}
            adminOnlyEdit={adminOnlyEdit}
            showAdminSettings={showAdminSettings}
        />,
    );

describe('Outline > handleAdminOnlyEditChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        toggleProps = null;
        statusUpdatesProps = null;
        retrospectiveProps = null;
        actionsProps = null;
        mockClientFetchPlaybook.mockResolvedValue(makeFullPlaybook({admin_only_edit: false}) as any);
    });

    it('calls savePlaybook with the toggled value', async () => {
        mockSavePlaybook.mockResolvedValue(undefined as any);
        renderOutline(false);

        await act(async () => {
            toggleProps!.onChange(true);
        });

        expect(mockSavePlaybook).toHaveBeenCalledTimes(1);
        expect(mockSavePlaybook).toHaveBeenCalledWith(
            expect.objectContaining({admin_only_edit: true}),
        );
    });

    it('applies the optimistic update immediately before savePlaybook resolves', async () => {
        let resolve: (value?: any) => void;
        mockSavePlaybook.mockReturnValue(new Promise<any>((r) => {
            resolve = r;
        }));

        const component = renderOutline(false);

        act(() => {
            toggleProps!.onChange(true);
        });

        // Toggle should reflect the new value before the network request completes.
        expect(toggleProps!.isChecked).toBe(true);

        await act(async () => {
            resolve!();
        });
        component.unmount();
    });

    it('reverts the optimistic update when savePlaybook rejects', async () => {
        mockSavePlaybook.mockRejectedValue(new Error('network error'));

        renderOutline(false);

        await act(async () => {
            toggleProps!.onChange(true);
        });

        // After rejection, toggle should revert to the original value.
        expect(toggleProps!.isChecked).toBe(false);
    });

    it('reverts to the optimistic state, not the stale prop, when two toggles race', async () => {
        let rejectFirst: (err: Error) => void;
        mockSavePlaybook
            .mockReturnValueOnce(new Promise<any>((_, r) => {
                rejectFirst = r;
            }))
            .mockResolvedValueOnce(undefined as any);

        renderOutline(false);

        // First toggle: false → true
        act(() => {
            toggleProps!.onChange(true);
        });
        expect(toggleProps!.isChecked).toBe(true);

        // Second toggle while first is in-flight: true → false
        act(() => {
            toggleProps!.onChange(false);
        });
        expect(toggleProps!.isChecked).toBe(false);

        // First request now fails — rollback restores prev=false (the value captured before the
        // first toggle fired, when adminOnlyEditOverride was undefined and fell back to
        // restPlaybook.admin_only_edit=false). The second toggle already moved state to false,
        // so both the rollback and the current state agree: state stays false.
        await act(async () => {
            rejectFirst!(new Error('network error'));
        });

        // The second toggle landed on false and succeeded; first rollback restored prev=false.
        // Net state should be false (both agree).
        expect(toggleProps!.isChecked).toBe(false);
    });

    it('does nothing when the playbook is archived', async () => {
        mockSavePlaybook.mockResolvedValue(undefined as any);
        renderOutline(false, true /* archived */);

        await act(async () => {
            toggleProps!.onChange(true);
        });

        expect(mockSavePlaybook).not.toHaveBeenCalled();
    });

    it('does not render the admin-only-edit toggle when showAdminSettings is false', () => {
        renderOutline(false, false, {showAdminSettings: false});

        expect(toggleProps).toBeNull();
    });
});

const renderOutlineWithCanEdit = (canEdit: boolean, archived = false) =>
    renderer.create(
        <Outline
            playbook={makeFullPlaybook({delete_at: archived ? 1 : 0}) as any}
            refetch={jest.fn()}
            canEdit={canEdit}
            adminOnlyEdit={false}
            showAdminSettings={true}
        />,
    );

const hasBulkEditButton = (tree: any): boolean => findNodeByTestId(tree, 'bulk-edit-button') !== null;

describe('Outline > canEdit behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        toggleProps = null;
        statusUpdatesProps = null;
        retrospectiveProps = null;
        actionsProps = null;
        mockClientFetchPlaybook.mockResolvedValue(makeFullPlaybook({admin_only_edit: false}) as any);
    });

    it('hides the bulk edit button when canEdit is false', () => {
        const component = renderOutlineWithCanEdit(false);
        expect(hasBulkEditButton(component.toJSON())).toBe(false);
    });

    it('shows the bulk edit button when canEdit is true', () => {
        const component = renderOutlineWithCanEdit(true);
        expect(hasBulkEditButton(component.toJSON())).toBe(true);
    });

    it('hides the bulk edit button when archived even if canEdit is true', () => {
        const component = renderOutlineWithCanEdit(true, true);
        expect(hasBulkEditButton(component.toJSON())).toBe(false);
    });

    it('passes canEdit=false to StatusUpdates', () => {
        renderOutlineWithCanEdit(false);
        expect(statusUpdatesProps?.canEdit).toBe(false);
    });

    it('passes canEdit=true to StatusUpdates', () => {
        renderOutlineWithCanEdit(true);
        expect(statusUpdatesProps?.canEdit).toBe(true);
    });

    it('passes canEdit=false to Retrospective', () => {
        renderOutlineWithCanEdit(false);
        expect(retrospectiveProps?.canEdit).toBe(false);
    });

    it('passes canEdit=true to Retrospective', () => {
        renderOutlineWithCanEdit(true);
        expect(retrospectiveProps?.canEdit).toBe(true);
    });

    it('passes canEdit=false to Actions', () => {
        renderOutlineWithCanEdit(false);
        expect(actionsProps?.canEdit).toBe(false);
    });

    it('passes canEdit=true to Actions', () => {
        renderOutlineWithCanEdit(true);
        expect(actionsProps?.canEdit).toBe(true);
    });
});
