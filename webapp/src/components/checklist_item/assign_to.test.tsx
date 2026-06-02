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
    useProfilesForRun: jest.fn(() => []),
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

    describe('role assignee display', () => {
        it('passes assignedDisplay to ProfileSelector when assignee_type is owner', () => {
            renderer.create(
                <AssignTo
                    assignee_id=''
                    assignee_type='owner'
                    participantUserIds={[]}
                    editable={true}
                    roleOptions={[{value: 'role:owner', label: 'Run Owner'}]}
                    mode='template'
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const props = MockProfileSelector.mock.calls[0][0];
            expect(props.selectedUserId).toBeUndefined();
            expect(props.assignedDisplay).toBeTruthy();
        });

        it('passes resolved user via assignedDisplay when property_user has a value in run mode', () => {
            renderer.create(
                <AssignTo
                    assignee_id='user-1'
                    assignee_type='property_user'
                    assignee_property_field_id='field-1'
                    participantUserIds={[]}
                    editable={true}
                    mode='run'
                    propertyFields={[{
                        id: 'field-1',
                        group_id: '',
                        name: 'Designer Baba',
                        type: 'user' as const,
                        target_id: '',
                        target_type: 'run' as const,
                        object_type: 'run',
                        attrs: {visibility: 'always' as const, sort_order: 0, options: null},
                        create_at: 0,
                        update_at: 0,
                        delete_at: 0,
                        created_by: '',
                        updated_by: '',
                    }]}
                    propertyValues={[{
                        id: 'v1',
                        field_id: 'field-1',
                        target_id: '',
                        target_type: 'run',
                        group_id: '',
                        value: 'user-1',
                        create_at: 0,
                        update_at: 0,
                        delete_at: 0,
                        created_by: '',
                        updated_by: '',
                    }]}
                />,
            );

            expect(MockProfileSelector).toHaveBeenCalled();
            const selectorProps = MockProfileSelector.mock.calls[0][0];
            expect(selectorProps.assignedDisplay).toBeTruthy();
        });
    });

    describe('edit-mode tooltip gating', () => {
        it('does not wrap with Assignee tooltip when role assignee_type is set', () => {
            const result = renderer.create(
                <AssignTo
                    assignee_id=''
                    assignee_type='owner'
                    participantUserIds={[]}
                    editable={true}
                    isEditing={true}
                />,
            );
            expect(result.root.findAll((node) => 'aria-describedby' in node.props).length).toEqual(0);
        });

        it('wraps with Assignee tooltip when nothing is assigned in edit mode', () => {
            const result = renderer.create(
                <AssignTo
                    assignee_id=''
                    assignee_type=''
                    participantUserIds={[]}
                    editable={true}
                    isEditing={true}
                />,
            );
            expect(result.root.findAll((node) => 'aria-describedby' in node.props).length).not.toEqual(0);
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
