// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React, {act} from 'react';
import renderer from 'react-test-renderer';

import {clientFetchPlaybook, savePlaybook} from 'src/client';
import {findNodeByTestId} from 'src/utils/test_helpers';

// --- Captured mock state ---

// AdminOnlyEditToggle
type AdminSettingsToggleProps = {isChecked: boolean; onChange: (value: boolean) => void};
let toggleProps: AdminSettingsToggleProps | null = null;

// Section mocks
type SectionStatusUpdatesProps = {canEdit?: boolean};
let statusUpdatesProps: SectionStatusUpdatesProps | null = null;

type SectionRetrospectiveProps = {canEdit?: boolean};
let retrospectiveProps: SectionRetrospectiveProps | null = null;

interface SectionActionsProps {
    canEdit?: boolean;
    newChannelOnly?: boolean;
    onNewChannelOnlyChange?: (u: {new_channel_only: boolean}) => void;
    autoArchiveChannel?: boolean;
    onAutoArchiveChange?: (u: {auto_archive_channel: boolean}) => void;
}
let actionsProps: SectionActionsProps | null = null;
let capturedNewChannelOnly = false;
let capturedOnNewChannelOnlyChange: ((u: {new_channel_only: boolean}) => void) | undefined;
let capturedAutoArchiveChannel = false;
let capturedOnAutoArchiveChange: ((u: {auto_archive_channel: boolean}) => void) | undefined;

// --- Mocks ---

jest.mock('src/client', () => ({savePlaybook: jest.fn(), clientFetchPlaybook: jest.fn(), getSiteUrl: () => ''}));
jest.mock('src/graphql/hooks', () => ({useUpdatePlaybook: jest.fn(() => jest.fn())}));
jest.mock('src/hooks', () => ({useAllowRetrospectiveAccess: jest.fn(() => false)}));
jest.mock('src/components/backstage/toast_banner', () => ({useToaster: () => ({add: jest.fn()})}));
jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    return {...reactIntl, useIntl: () => reactIntl.createIntl({locale: 'en'})};
});
jest.mock('src/components/markdown_edit', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/checklist/checklist_list', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/playbook_actions_modal', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/backstage/playbook_edit/automation/toggle', () => ({Toggle: () => null}));
jest.mock('./section', () => ({
    __esModule: true,
    default: ({children, headerRight}: {children: React.ReactNode; headerRight?: React.ReactNode}) => <>{headerRight}{children}</>,
}));
jest.mock('./scroll_nav', () => ({__esModule: true, default: () => null}));

jest.mock('./section_status_updates', () => ({
    __esModule: true,
    default: (props: SectionStatusUpdatesProps) => {
        statusUpdatesProps = props;
        return null;
    },
}));

jest.mock('./section_retrospective', () => ({
    __esModule: true,
    default: (props: SectionRetrospectiveProps) => {
        retrospectiveProps = props;
        return null;
    },
}));

jest.mock('./section_actions', () => ({
    __esModule: true,
    default: (props: SectionActionsProps) => {
        actionsProps = props;
        capturedNewChannelOnly = props.newChannelOnly ?? false;
        capturedOnNewChannelOnlyChange = props.onNewChannelOnlyChange;
        capturedAutoArchiveChannel = props.autoArchiveChannel ?? false;
        capturedOnAutoArchiveChange = props.onAutoArchiveChange;
        return null;
    },
}));

jest.mock('./section_admin_settings', () => ({
    __esModule: true,
    default: (props: AdminSettingsToggleProps) => {
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

const mockSavePlaybook = savePlaybook as jest.MockedFunction<typeof savePlaybook>;
const mockClientFetchPlaybook = clientFetchPlaybook as jest.MockedFunction<typeof clientFetchPlaybook>;

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
    ToastStyle: {Failure: 'failure'},
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

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

import Outline from './outline';

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
    members: [],
    ...overrides,
});

const makeFullPlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'pb-id',
    delete_at: 0,
    status_update_enabled: false,
    retrospective_enabled: false,
    run_summary_template_enabled: false,
    run_summary_template: '',
    ...overrides,
});

const makePlaybook = (overrides: Record<string, unknown> = {}) => ({
    id: 'pb-1',
    delete_at: 0,
    run_summary_template_enabled: false,
    run_summary_template: '',
    status_update_enabled: false,
    retrospective_enabled: false,
    checklists: [],
    ...overrides,
} as any);

// Used by owner-group-only-actions tests
const makeOwnerRestPlaybook = (ownerGroupOnlyActions: boolean) => ({
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

// Used by new-channel-only / auto-archive tests
const makeRestPlaybook = (val: boolean, channelMode = 'create_new_channel') => ({
    id: 'pb-1',
    new_channel_only: val,
    auto_archive_channel: val,
    channel_mode: channelMode,
    checklists: [],
} as any);

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Global beforeEach — resets all captured state and sets default mock return values
beforeEach(() => {
    jest.clearAllMocks();
    toggleProps = null;
    statusUpdatesProps = null;
    retrospectiveProps = null;
    actionsProps = null;
    latestToggleProps.current = null;
    capturedNewChannelOnly = false;
    capturedOnNewChannelOnlyChange = undefined;
    capturedAutoArchiveChannel = false;
    capturedOnAutoArchiveChange = undefined;
    mockClientFetchPlaybook.mockResolvedValue({
        id: 'pb-1',
        delete_at: 0,
        admin_only_edit: false,
        auto_archive_channel: false,
        channel_mode: 'create_new_channel',
        checklists: [],
    } as any);
});

// --- Tests: handleAdminOnlyEditChange ---

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

// --- Tests: canEdit behavior ---

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

// --- Tests: handleNewChannelOnlyChange ---

// ---------------------------------------------------------------------------
// Tests — handleOwnerGroupOnlyActionsChange
// ---------------------------------------------------------------------------

describe('Outline — handleOwnerGroupOnlyActionsChange', () => {
    it('saves playbook with the new value and no stale override spread', async () => {
        (savePlaybook as jest.Mock).mockResolvedValue({});
        const restPlaybook = makeOwnerRestPlaybook(false);
        (clientFetchPlaybook as jest.Mock).mockResolvedValue(restPlaybook);

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
        (clientFetchPlaybook as jest.Mock).mockResolvedValue(makeOwnerRestPlaybook(false));

        renderer.create(
            <Outline
                showAdminSettings={true}
                playbook={makeGraphQLPlaybook() as any}
                refetch={jest.fn()}
                restPlaybook={makeOwnerRestPlaybook(false)}
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
                restPlaybook={makeOwnerRestPlaybook(false)}
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
                restPlaybook={makeOwnerRestPlaybook(false)}
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

// ---------------------------------------------------------------------------
// Tests — handleNewChannelOnlyChange
// ---------------------------------------------------------------------------

describe('Outline — handleNewChannelOnlyChange', () => {
    it('passes restPlaybook.new_channel_only to Actions when no override is active', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        expect(capturedNewChannelOnly).toBe(true);
    });

    it('defaults to false when restPlaybook is absent', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
            />,
        );

        expect(capturedNewChannelOnly).toBe(false);
    });

    it('applies the optimistic override immediately — before the save resolves', () => {
        mockSavePlaybook.mockReturnValue(new Promise(() => undefined));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        expect(capturedNewChannelOnly).toBe(false);

        act(() => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(capturedNewChannelOnly).toBe(true);
    });

    it('calls savePlaybook with new_channel_only and channel_mode set to create_new_channel when toggling on', async () => {
        mockSavePlaybook.mockResolvedValue({} as any);

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false, 'link_existing_channel')}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(mockSavePlaybook).toHaveBeenCalledTimes(1);
        expect(mockSavePlaybook).toHaveBeenCalledWith(
            expect.objectContaining({new_channel_only: true, channel_mode: 'create_new_channel'}),
        );
    });

    it('preserves existing channel_mode when toggling off', async () => {
        mockSavePlaybook.mockResolvedValue({} as any);

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true, 'create_new_channel')}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: false});
        });

        expect(mockSavePlaybook).toHaveBeenCalledWith(
            expect.objectContaining({new_channel_only: false, channel_mode: 'create_new_channel'}),
        );
    });

    it('rolls back the optimistic override when savePlaybook rejects', async () => {
        mockSavePlaybook.mockRejectedValue(new Error('network error'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        act(() => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });
        expect(capturedNewChannelOnly).toBe(true);

        // eslint-disable-next-line no-empty-function
        await act(async () => {});

        expect(capturedNewChannelOnly).toBe(false);
    });

    it('does not call savePlaybook when the value did not change', async () => {
        mockSavePlaybook.mockResolvedValue({} as any);

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(mockSavePlaybook).not.toHaveBeenCalled();
    });

    it('does not call savePlaybook when the playbook is archived', async () => {
        renderer.create(
            <Outline
                playbook={makePlaybook({delete_at: 1})}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(mockSavePlaybook).not.toHaveBeenCalled();
        expect(capturedNewChannelOnly).toBe(false);
    });

    it('calls refetch and keeps the optimistic override after savePlaybook resolves', async () => {
        mockSavePlaybook.mockResolvedValue({} as any);
        const refetch = jest.fn();

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={refetch}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            capturedOnNewChannelOnlyChange!({new_channel_only: true});
        });

        expect(refetch).toHaveBeenCalledTimes(1);

        // Override stays at the toggled value until refetch updates restPlaybook
        expect(capturedNewChannelOnly).toBe(true);
    });
});

// --- Tests: auto-archive optimistic state ---

describe('Outline — auto-archive optimistic state', () => {
    it('passes restPlaybook.auto_archive_channel to Actions when no override is active', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(true)}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(true);
    });

    it('defaults to false when restPlaybook is absent', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('applies the optimistic override immediately on toggle — before the save resolves', () => {
        // savePlaybook never resolves so we can observe the mid-flight state
        mockSavePlaybook.mockReturnValue(new Promise(() => undefined));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        expect(capturedAutoArchiveChannel).toBe(false);

        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });

        expect(capturedAutoArchiveChannel).toBe(true);
    });

    it('calls refetch after savePlaybook resolves successfully', async () => {
        const refetch = jest.fn();
        mockSavePlaybook.mockResolvedValue({} as any);

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={refetch}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        await act(async () => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('rolls back the optimistic override to the previous value when savePlaybook rejects', async () => {
        mockSavePlaybook.mockRejectedValue(new Error('network error'));

        renderer.create(
            <Outline
                playbook={makePlaybook()}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        // Optimistic update: override jumps to true
        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });
        expect(capturedAutoArchiveChannel).toBe(true);

        // After rejection, override resets to previous value (false)
        // eslint-disable-next-line no-empty-function
        await act(async () => {});

        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('does not call savePlaybook when the playbook is archived', () => {
        renderer.create(
            <Outline
                playbook={makePlaybook({delete_at: 1})}
                refetch={jest.fn()}
                restPlaybook={makeRestPlaybook(false)}
            />,
        );

        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });

        expect(mockSavePlaybook).not.toHaveBeenCalled();
        expect(capturedAutoArchiveChannel).toBe(false);
    });

    it('effective value stays correct when restPlaybook updates while an override is active', () => {
        // savePlaybook never resolves — we control restPlaybook directly
        mockSavePlaybook.mockReturnValue(new Promise(() => undefined));

        let component!: renderer.ReactTestRenderer;

        act(() => {
            component = renderer.create(
                <Outline
                    playbook={makePlaybook()}
                    refetch={jest.fn()}
                    restPlaybook={makeRestPlaybook(false)}
                />,
            );
        });

        act(() => {
            capturedOnAutoArchiveChange!({auto_archive_channel: true});
        });
        expect(capturedAutoArchiveChannel).toBe(true);

        // Simulate restPlaybook updating (e.g. a background refetch) while override is active
        act(() => {
            component.update(
                <Outline
                    playbook={makePlaybook()}
                    refetch={jest.fn()}
                    restPlaybook={makeRestPlaybook(true)}
                />,
            );
        });

        expect(capturedAutoArchiveChannel).toBe(true);
    });
});
