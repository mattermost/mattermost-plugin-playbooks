// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import {ButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

import RHSChecklistList, {ChecklistParent} from './rhs_checklist_list';

jest.mock('src/hooks/redux', () => ({
    useAppDispatch: () => jest.fn(),
    useAppSelector: (selector: unknown) => mockSelect(selector),
}));

const mockSelect = jest.fn();

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUser: 'getCurrentUser',
}));
jest.mock('mattermost-redux/selectors/entities/preferences', () => ({
    getTeammateNameDisplaySetting: 'getTeammateNameDisplaySetting',
}));
jest.mock('mattermost-redux/utils/user_utils', () => ({
    displayUsername: () => 'Alice',
}));

jest.mock('src/selectors', () => ({
    currentChecklistAllCollapsed: () => 'allCollapsed',
    currentChecklistCollapsedState: () => 'collapsedState',
    currentChecklistItemsFilter: () => ({all: true, checked: true, skipped: true, me: true, unassigned: true, others: true, overdueOnly: false}),
}));

jest.mock('src/actions', () => ({}));

const mockChecklistList = jest.fn();
jest.mock('src/components/checklist/checklist_list', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockChecklistList(props);
        return <div data-testid='checklist-list'/>;
    },
}));

const mockFooter = jest.fn();
jest.mock('./rhs_checklist_list_footer', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockFooter(props);
        return null;
    },
}));

let mockTourStepVisible = true;
jest.mock('src/components/tutorial/tutorial_tour_tip', () => ({
    __esModule: true,
    default: () => <div data-testid='tour-tip'/>,
    useMeasurePunchouts: () => ({}),
    useShowTutorialStep: () => mockTourStepVisible,
}));
jest.mock('src/components/tutorial/tours', () => ({
    RunDetailsTutorialSteps: {Checklists: 1},
    TutorialTourCategories: {RUN_DETAILS: 'run_details'},
}));

jest.mock('src/hooks', () => ({
    useParticipateInRun: () => ({ParticipateConfirmModal: null, showParticipateConfirm: jest.fn()}),
}));
jest.mock('src/components/backstage/playbook_runs/playbook_run/restore_run', () => ({
    useOnRestoreRun: () => jest.fn(),
}));
jest.mock('src/hooks/run_permissions', () => ({
    useCanModifyRun: () => true,
    useCanRestoreRun: () => true,
}));
jest.mock('src/components/multi_checkbox', () => ({__esModule: true, default: () => null}));
jest.mock('src/components/dot_menu', () => ({DotMenuButton: 'button'}));
jest.mock('src/components/backstage/playbook_runs/shared', () => ({AnchorLinkTitle: () => null}));
jest.mock('src/components/rhs/rhs_shared', () => ({HoverMenu: 'div', HoverMenuButton: 'button'}));
jest.mock('src/components/checklist_item/checklist_item', () => ({
    ButtonsFormat: {Long: 'long', Mixed: 'mixed', Short: 'short'},
}));

const run = (type: PlaybookRunType = PlaybookRunType.ChannelChecklist) => ({
    id: 'run_1',
    type,
    channel_id: 'channel_1',
    team_id: 'team_1',
    owner_user_id: 'user_1',
    participant_ids: ['user_1'],
    current_status: PlaybookRunStatus.InProgress,
    checklists: [],
}) as unknown as PlaybookRun;

const renderList = (props: Partial<React.ComponentProps<typeof RHSChecklistList>> & {parentContainer: ChecklistParent}) => render(
    <IntlProvider locale='en'>
        <RHSChecklistList
            playbookRun={run()}
            readOnly={false}
            {...props}
        />
    </IntlProvider>,
);

const lastProps = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0];

describe('RHSChecklistList', () => {
    beforeEach(() => {
        mockChecklistList.mockClear();
        mockFooter.mockClear();
        mockTourStepVisible = true;
        mockSelect.mockImplementation((selector: unknown) => {
            switch (selector) {
            case 'getCurrentUser':
                return {id: 'user_1'};
            case 'getTeammateNameDisplaySetting':
                return 'username';
            case 'allCollapsed':
                return false;
            case 'collapsedState':
                return {};
            default:
                return {all: true, checked: true, skipped: true, me: true, unassigned: true, others: true, overdueOnly: false};
            }
        });
    });

    it('keeps the tutorial tip for the RHS', () => {
        renderList({parentContainer: ChecklistParent.RHS});

        expect(screen.queryByTestId('tour-tip')).not.toBeNull();
    });

    it('never shows the tutorial tip for the embedded parent', () => {
        renderList({parentContainer: ChecklistParent.Embedded});

        expect(screen.queryByTestId('tour-tip')).toBeNull();
    });

    it('uses the short buttons format in the RHS and the long one in run details', () => {
        renderList({parentContainer: ChecklistParent.RHS});
        expect(lastProps(mockChecklistList).itemButtonsFormat).toBe(ButtonsFormat.Short);

        renderList({parentContainer: ChecklistParent.RunDetails});
        expect(lastProps(mockChecklistList).itemButtonsFormat).toBe(ButtonsFormat.Long);
    });

    it.each([ButtonsFormat.Short, ButtonsFormat.Long, ButtonsFormat.Mixed])('lets the embedded parent choose the %s buttons format', (buttonsFormat) => {
        renderList({parentContainer: ChecklistParent.Embedded, buttonsFormat});

        expect(lastProps(mockChecklistList).itemButtonsFormat).toBe(buttonsFormat);
    });

    it('passes the run and read-only flag to the checklist list for the embedded parent', () => {
        renderList({parentContainer: ChecklistParent.Embedded, readOnly: true});

        expect(lastProps(mockChecklistList)).toMatchObject({
            isReadOnly: true,
            playbookRun: expect.objectContaining({id: 'run_1'}),
        });
    });

    it('hands the embedded parent to the footer, which only renders for the RHS', () => {
        renderList({parentContainer: ChecklistParent.Embedded});

        expect(lastProps(mockFooter).parentContainer).toBe(ChecklistParent.Embedded);
    });
});
