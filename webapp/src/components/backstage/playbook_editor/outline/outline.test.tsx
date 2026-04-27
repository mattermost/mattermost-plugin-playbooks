// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tests for handleAdminOnlyEditChange: optimistic update, savePlaybook call, and rollback on failure.

import React from 'react';
import renderer, {act} from 'react-test-renderer';

import {savePlaybook} from 'src/client';
import {makeBasePlaybook} from 'src/utils/test_helpers';
import {PlaybookWithChecklist} from 'src/types/playbook';

jest.mock('src/client', () => ({savePlaybook: jest.fn(), getSiteUrl: () => ''}));
jest.mock('src/graphql/hooks', () => ({useUpdatePlaybook: () => jest.fn()}));
jest.mock('src/hooks', () => ({useAllowRetrospectiveAccess: () => true}));
jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {...reactIntl, useIntl: () => reactIntl.createIntl({locale: 'en'})};
});
jest.mock('@mattermost/compass-icons/components', () => ({SettingsOutlineIcon: () => null}));
jest.mock('src/components/markdown_edit', () => () => null);
jest.mock('src/components/checklist/checklist_list', () => () => null);
jest.mock('src/components/playbook_actions_modal', () => () => null);
jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({Toggle: () => null}));
jest.mock('./section', () => ({__esModule: true, default: ({children}: {children: React.ReactNode}) => <>{children}</>}));
jest.mock('./section_status_updates', () => () => null);
jest.mock('./section_retrospective', () => () => null);
jest.mock('./section_actions', () => () => null);
jest.mock('./scroll_nav', () => () => null);

// Capture the onChange/playbook props passed to AdminOnlyEditToggle so tests can drive and inspect state.
type ToggleProps = {playbook: {admin_only_edit: boolean}; onChange: (u: {admin_only_edit: boolean}) => void};
let toggleProps: ToggleProps | null = null;
jest.mock('src/components/backstage/playbook_editor/admin_only_edit_toggle', () => ({
    __esModule: true,
    default: (props: ToggleProps) => {
        toggleProps = props;
        return (
            <span
                data-testid='mock-toggle'
                data-value={String(props.playbook.admin_only_edit)}
            />
        );
    },
}));

import Outline from './outline';

const mockSavePlaybook = savePlaybook as jest.MockedFunction<typeof savePlaybook>;

const makeFullPlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'pb-id',
    delete_at: 0,
    status_update_enabled: false,
    retrospective_enabled: false,
    run_summary_template_enabled: false,
    run_summary_template: '',
    ...overrides,
});

const makeRestPlaybook = (adminOnlyEdit: boolean) =>
    makeBasePlaybook({admin_only_edit: adminOnlyEdit}) as unknown as PlaybookWithChecklist;

const renderOutline = (adminOnlyEdit: boolean, archived = false) =>
    renderer.create(
        <Outline
            playbook={makeFullPlaybook({delete_at: archived ? 1 : 0}) as any}
            refetch={jest.fn()}
            canEdit={true}
            restPlaybook={makeRestPlaybook(adminOnlyEdit)}
            showAdminSettings={true}
        />,
    );

describe('Outline > handleAdminOnlyEditChange', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        toggleProps = null;
    });

    it('calls savePlaybook with the toggled value', () => {
        mockSavePlaybook.mockResolvedValue(undefined as any);
        renderOutline(false);

        act(() => {
            toggleProps!.onChange({admin_only_edit: true});
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
            toggleProps!.onChange({admin_only_edit: true});
        });

        // Toggle should reflect the new value before the network request completes.
        expect(toggleProps!.playbook.admin_only_edit).toBe(true);

        await act(async () => {
            resolve!();
        });
        component.unmount();
    });

    it('reverts the optimistic update when savePlaybook rejects', async () => {
        mockSavePlaybook.mockRejectedValue(new Error('network error'));

        renderOutline(false);

        await act(async () => {
            toggleProps!.onChange({admin_only_edit: true});
        });

        // After rejection, toggle should revert to the original value.
        expect(toggleProps!.playbook.admin_only_edit).toBe(false);
    });

    it('does nothing when the playbook is archived', () => {
        mockSavePlaybook.mockResolvedValue(undefined as any);
        renderOutline(false, true /* archived */);

        act(() => {
            toggleProps!.onChange({admin_only_edit: true});
        });

        expect(mockSavePlaybook).not.toHaveBeenCalled();
    });
});
