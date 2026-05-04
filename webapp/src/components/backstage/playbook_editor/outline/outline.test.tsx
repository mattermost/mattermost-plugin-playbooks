// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React, {act} from 'react';
import renderer from 'react-test-renderer';

import {savePlaybook} from 'src/client';

import Outline from './outline';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/client', () => ({
    savePlaybook: jest.fn(),
}));

jest.mock('src/graphql/hooks', () => ({
    useUpdatePlaybook: () => jest.fn(),
}));

jest.mock('src/hooks', () => ({
    useAllowRetrospectiveAccess: () => true,
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/markdown_edit', () => () => null);
jest.mock('src/components/checklist/checklist_list', () => () => null);
jest.mock('src/components/playbook_actions_modal', () => () => null);
jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({
    Toggle: () => null,
}));
jest.mock('src/components/backstage/playbook_edit/styles', () => ({
    Section: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
    SectionTitle: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
    ToastStyle: {Failure: 'failure'},
}));

jest.mock('./section_status_updates', () => () => null);
jest.mock('./section_retrospective', () => () => null);
jest.mock('./section_actions', () => () => null);
jest.mock('./scroll_nav', () => () => null);
jest.mock('./section', () => ({children}: {children: React.ReactNode}) => <div>{children}</div>);

// Capture the latest props passed to OwnerGroupOnlyActionsToggle so tests
// can invoke its onChange and observe the playbook prop (which reflects
// optimistic updates and rollback on save failure).
type ToggleProps = {
    playbook: {owner_group_only_actions?: boolean};
    isPlaybookAdmin: boolean;
    disabled?: boolean;
    onChange: (updated: {owner_group_only_actions: boolean}) => void;
};
const latestToggleProps: {current: ToggleProps | null} = {current: null};
jest.mock('src/components/backstage/playbook_editor/owner_group_only_actions_toggle', () => (props: ToggleProps) => {
    latestToggleProps.current = props;
    return null;
});

jest.mock('src/hooks/redux', () => ({
    useAppSelector: () => 'user-1',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeGraphQLPlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'playbook-1',
    title: 'Test Playbook',
    delete_at: 0,
    status_update_enabled: true,
    retrospective_enabled: true,
    run_summary_template_enabled: false,
    run_summary_template: '',
    checklists: [],
    ...overrides,
});

const makeRestPlaybook = (ownerGroupOnlyActions: boolean) => ({
    id: 'playbook-1',
    title: 'Test Playbook',
    description: '',
    team_id: 'team-1',
    public: true,
    create_public_playbook_run: false,
    delete_at: 0,
    num_stages: 0,
    num_steps: 0,
    num_runs: 0,
    num_actions: 0,
    last_run_at: 0,
    members: [],
    default_playbook_member_role: '',
    active_runs: 0,
    default_owner_id: '',
    default_owner_enabled: false,
    run_summary_template_enabled: false,
    owner_group_only_actions: ownerGroupOnlyActions,
} as any);

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
    latestToggleProps.current = null;
    (savePlaybook as jest.Mock).mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Outline — handleOwnerGroupOnlyActionsChange', () => {
    it('saves playbook with the new value and no stale override spread', async () => {
        (savePlaybook as jest.Mock).mockResolvedValue({});
        const restPlaybook = makeRestPlaybook(false);

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook() as any}
                refetch={jest.fn()}
                restPlaybook={restPlaybook}
            />,
        );

        expect(latestToggleProps.current).not.toBeNull();
        await act(async () => {
            latestToggleProps.current!.onChange({owner_group_only_actions: true});
        });

        expect(savePlaybook).toHaveBeenCalledTimes(1);
        const saved = (savePlaybook as jest.Mock).mock.calls[0][0];
        expect(saved.owner_group_only_actions).toBe(true);
        expect(saved.id).toBe(restPlaybook.id);
    });

    it('optimistically updates the toggle playbook prop before save resolves', async () => {
        let resolveSave: (v: unknown) => void = () => undefined;
        (savePlaybook as jest.Mock).mockReturnValue(new Promise((resolve) => {
            resolveSave = resolve;
        }));

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook() as any}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        expect(latestToggleProps.current!.playbook.owner_group_only_actions).toBe(false);

        await act(async () => {
            latestToggleProps.current!.onChange({owner_group_only_actions: true});
        });

        // Optimistic: toggle sees the new value before the save resolves.
        expect(latestToggleProps.current!.playbook.owner_group_only_actions).toBe(true);

        await act(async () => {
            resolveSave({});
            await flush();
        });

        expect(latestToggleProps.current!.playbook.owner_group_only_actions).toBe(true);
    });

    it('rolls back the toggle playbook prop when savePlaybook rejects', async () => {
        (savePlaybook as jest.Mock).mockRejectedValue(new Error('network error'));

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook() as any}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            latestToggleProps.current!.onChange({owner_group_only_actions: true});
            await flush();
        });

        // After rejection, the optimistic override is reverted to the prior value.
        expect(latestToggleProps.current!.playbook.owner_group_only_actions).toBe(false);
    });

    it('does nothing when the playbook is archived', async () => {
        (savePlaybook as jest.Mock).mockResolvedValue({});

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook({delete_at: 123456}) as any}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            latestToggleProps.current!.onChange({owner_group_only_actions: true});
        });

        expect(savePlaybook).not.toHaveBeenCalled();
        expect(latestToggleProps.current!.playbook.owner_group_only_actions).toBe(false);
    });

    it('does nothing when restPlaybook is undefined', async () => {
        (savePlaybook as jest.Mock).mockResolvedValue({});

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook() as any}
                refetch={jest.fn()}
                restPlaybook={undefined}
            />,
        );

        // Toggle is not rendered without effectiveRestPlaybook, so no onChange path
        // to invoke. Assert the component is gated out.
        expect(latestToggleProps.current).toBeNull();
        expect(savePlaybook).not.toHaveBeenCalled();
    });
});
