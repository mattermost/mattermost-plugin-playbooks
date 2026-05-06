// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer from 'react-test-renderer';

import ProfileSelectorDefault from 'src/components/profile/profile_selector';

import AssignTo from './assign_to';

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}));

jest.mock('src/hooks', () => ({
    useProfilesInTeam: jest.fn(() => []),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/components/rhs/rhs_shared', () => ({
    ChecklistHoverMenuButton: ({children}: any) => <button>{children}</button>,
}));

const MockProfileSelector = ProfileSelectorDefault as unknown as jest.Mock;

describe('AssignTo', () => {
    beforeEach(() => {
        MockProfileSelector.mockClear();
    });

    describe('roleOptions → extraSections', () => {
        it('passes role options as a RUN ROLES extraSection to ProfileSelector', () => {
            const roleOptions = [
                {value: 'role:owner', label: 'Run Owner'},
                {value: 'role:creator', label: 'Run Creator'},
            ];

            renderer.create(
                <AssignTo
                    assignee_id=''
                    participantUserIds={[]}
                    editable={true}
                    roleOptions={roleOptions}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {extraSections} = MockProfileSelector.mock.calls[0][0];
            expect(extraSections).toHaveLength(1);
            expect(extraSections[0].label).toBe('RUN ROLES');
            expect(extraSections[0].options).toHaveLength(2);
            expect(extraSections[0].options[0].value).toBe('role:owner');
            expect(extraSections[0].options[1].value).toBe('role:creator');
        });

        it('passes undefined extraSections when no roleOptions provided', () => {
            renderer.create(
                <AssignTo
                    assignee_id=''
                    participantUserIds={[]}
                    editable={true}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {extraSections} = MockProfileSelector.mock.calls[0][0];
            expect(extraSections).toBeUndefined();
        });

        it('passes undefined extraSections when roleOptions is empty', () => {
            renderer.create(
                <AssignTo
                    assignee_id=''
                    participantUserIds={[]}
                    editable={true}
                    roleOptions={[]}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {extraSections} = MockProfileSelector.mock.calls[0][0];
            expect(extraSections).toBeUndefined();
        });
    });

    describe('showCustomReset in hover menu mode', () => {
        it('is true when assignee_type is set and assignee_id is empty', () => {
            renderer.create(
                <AssignTo
                    assignee_id=''
                    assignee_type='owner'
                    participantUserIds={[]}
                    editable={true}
                    inHoverMenu={true}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {customControlProps} = MockProfileSelector.mock.calls[0][0];
            expect(customControlProps.showCustomReset).toBe(true);
        });

        it('is true when assignee_id is set', () => {
            renderer.create(
                <AssignTo
                    assignee_id='user-1'
                    assignee_type=''
                    participantUserIds={[]}
                    editable={true}
                    inHoverMenu={true}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {customControlProps} = MockProfileSelector.mock.calls[0][0];
            expect(customControlProps.showCustomReset).toBe(true);
        });

        it('is false when neither assignee_id nor assignee_type is set', () => {
            renderer.create(
                <AssignTo
                    assignee_id=''
                    assignee_type=''
                    participantUserIds={[]}
                    editable={true}
                    inHoverMenu={true}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const {customControlProps} = MockProfileSelector.mock.calls[0][0];
            expect(customControlProps.showCustomReset).toBe(false);
        });
    });
});
