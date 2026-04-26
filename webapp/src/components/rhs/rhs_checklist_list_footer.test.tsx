// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';
import * as reduxModule from 'react-redux';

jest.mock('./rhs_checklist_list', () => ({
    ChecklistParent: {
        RHS: 'rhs',
        RunDetails: 'run_details',
    },
}));

import RHSFooter from './rhs_checklist_list_footer';
import {ChecklistParent} from './rhs_checklist_list';

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('react-redux', () => ({
    useDispatch: jest.fn(() => jest.fn()),
    useSelector: jest.fn(() => false),
}));

jest.mock('react-bootstrap', () => ({
    OverlayTrigger: ({children}: {children: React.ReactNode}) => <>{children}</>,
    Tooltip: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('src/actions', () => ({
    finishRun: jest.fn(() => ({type: 'FINISH_RUN'})),
}));

jest.mock('src/components/widgets/confirmation_modal', () => ({
    makeUncontrolledConfirmModalDefinition: (props: any) => ({type: 'CONFIRM_MODAL', props}),
}));

jest.mock('src/components/backstage/lhs_navigation', () => ({
    useLHSRefresh: () => jest.fn(),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: () => ({add: jest.fn()}),
}));

jest.mock('src/selectors', () => ({
    isCurrentUserAdmin: () => false,
}));

jest.mock('src/components/assets/buttons', () => ({
    PrimaryButton: 'button',
    TertiaryButton: 'button',
}));

jest.mock('src/webapp_globals', () => ({
    Timestamp: () => <span>{'some time ago'}</span>,
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    AccountPlusOutlineIcon: () => null,
    CheckIcon: () => null,
    FlagCheckeredIcon: () => null,
    FlagOutlineIcon: () => null,
}));

const mockUseSelector = reduxModule.useSelector as unknown as jest.Mock;

const mockPlaybookRun = {
    id: 'run-1',
    name: 'Test Run',
    owner_user_id: 'user-1',
    team_id: 'team-1',
    type: 'playbook',
    end_at: Date.now(),
} as any;

const baseProps = {
    playbookRun: mockPlaybookRun,
    parentContainer: ChecklistParent.RHS,
    active: true,
    finished: false,
    canModify: true,
    canRestore: false,
    isParticipant: true,
    showParticipateConfirm: jest.fn(),
    handleResume: jest.fn(),
};

describe('RHSFooter - ownerGroupOnlyActions finish restriction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseSelector.mockReturnValue(false); // not a system admin by default
    });

    it('shows the finish section when ownerGroupOnlyActions is false', () => {
        const component = renderer.create(
            <RHSFooter
                {...baseProps}
                ownerGroupOnlyActions={false}
                isOwner={false}
            />,
        );

        const instance = component.root;
        const finishSection = instance.findAll((node) => node.props['data-testid'] === 'rhs-finish-section');
        expect(finishSection.length).toBeGreaterThan(0);
    });

    it('shows the finish section to the run owner when ownerGroupOnlyActions is true', () => {
        const component = renderer.create(
            <RHSFooter
                {...baseProps}
                ownerGroupOnlyActions={true}
                isOwner={true}
            />,
        );

        const instance = component.root;
        const finishSection = instance.findAll((node) => node.props['data-testid'] === 'rhs-finish-section');
        expect(finishSection.length).toBeGreaterThan(0);
    });

    it('hides the finish section from non-owners when ownerGroupOnlyActions is true', () => {
        const component = renderer.create(
            <RHSFooter
                {...baseProps}
                ownerGroupOnlyActions={true}
                isOwner={false}
            />,
        );

        const instance = component.root;
        const finishSection = instance.findAll((node) => node.props['data-testid'] === 'rhs-finish-section');
        expect(finishSection.length).toBe(0);
    });

    it('shows the finish section to system admins even when ownerGroupOnlyActions is true and isOwner is false', () => {
        mockUseSelector.mockReturnValue(true); // is system admin
        const component = renderer.create(
            <RHSFooter
                {...baseProps}
                ownerGroupOnlyActions={true}
                isOwner={false}
            />,
        );

        const instance = component.root;
        const finishSection = instance.findAll((node) => node.props['data-testid'] === 'rhs-finish-section');
        expect(finishSection.length).toBeGreaterThan(0);
    });
});
