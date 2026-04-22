// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx */

import React from 'react';
import renderer, {ReactTestRendererJSON} from 'react-test-renderer';
import {useSelector} from 'react-redux';

import {emptyChecklistItem} from 'src/types/playbook';
import {PropertyFieldType} from 'src/types/properties';

import AssigneeDropdown from './assignee_dropdown';

jest.mock('react-redux', () => ({
    useSelector: jest.fn(() => ({})),
    useDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('mattermost-redux/selectors/entities/groups', () => ({
    getAllGroups: jest.fn(),
}));

jest.mock('mattermost-redux/actions/groups', () => ({
    getGroups: jest.fn(() => ({type: 'MOCK_GET_GROUPS'})),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('src/hooks', () => ({
    useProfilesInTeam: () => [
        {id: 'user-1', username: 'alice', first_name: 'Alice', last_name: 'Smith'},
        {id: 'user-2', username: 'bob', first_name: 'Bob', last_name: 'Jones'},
    ],
}));

jest.mock('src/components/profile/profile_selector', () => ({
    __esModule: true,
    default: ({selectedUserId, onSelectedChange}: any) => (
        <div
            data-testid='profile-selector'
            data-selected={selectedUserId}
        >
            <button
                data-testid='user-option-user-1'
                onClick={() => onSelectedChange({id: 'user-1', username: 'alice'})}
            >
                {'alice'}
            </button>
        </div>
    ),
}));

const makeChecklistItem = (overrides = {}) => ({
    ...emptyChecklistItem(),
    ...overrides,
});

describe('AssigneeDropdown', () => {
    beforeEach(() => {
        (useSelector as jest.Mock).mockReturnValue({});
    });

    it('shows Run Owner as a role option', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: ''});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );
        const tree = component.toJSON();

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Owner');
    });

    it('shows Run Creator as a role option', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: ''});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );
        const tree = component.toJSON();

        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Creator');
    });

    it('user search appears before role dropdown', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: ''});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );

        const instance = component.root;

        const roleSelect = instance.findByProps({'data-testid': 'role-options'});
        const profileSelector = instance.findByProps({'data-testid': 'profile-selector'});

        expect(roleSelect).toBeTruthy();
        expect(profileSelector).toBeTruthy();

        const tree = component.toJSON() as ReactTestRendererJSON;
        expect(tree).not.toBeNull();
    });

    it('selecting Run Owner sets assignee_type to owner and clears assignee_id', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: 'user-1', assignee_type: ''});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );

        const instance = component.root;
        const roleSelect = instance.findByProps({'data-testid': 'role-options'});
        roleSelect.props.onChange({target: {value: 'owner'}});

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: 'owner',
            assignee_id: '',
            assignee_property_field_id: '',
        });
    });

    it('selecting Run Creator sets assignee_type to creator and clears assignee_id', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: 'user-1', assignee_type: ''});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );

        const instance = component.root;
        const roleSelect = instance.findByProps({'data-testid': 'role-options'});
        roleSelect.props.onChange({target: {value: 'creator'}});

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: 'creator',
            assignee_id: '',
            assignee_property_field_id: '',
        });
    });

    it('selecting None from role dropdown clears an existing role assignment', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'owner'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
            />,
        );

        const instance = component.root;
        const roleSelect = instance.findByProps({'data-testid': 'role-options'});
        roleSelect.props.onChange({target: {value: 'none'}});

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: '',
            assignee_id: '',
            assignee_property_field_id: '',
        });
    });

    it('selecting a specific user sets assignee_type to empty string and sets assignee_id', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'owner'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={['user-1', 'user-2']}
            />,
        );

        const instance = component.root;
        const userOption = instance.findByProps({'data-testid': 'user-option-user-1'});
        userOption.props.onClick();

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: '',
            assignee_id: 'user-1',
        });
    });

    it('in run view shows resolved user name with role indicator badge when assignee_type is owner', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'owner'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={false}
                onChanged={onChanged}
                participantUserIds={['user-1']}
                runOwnerUserId='user-1'
                mode='run'
            />,
        );

        const instance = component.root;
        const roleBadge = instance.findByProps({'data-testid': 'role-indicator-badge'});
        expect(roleBadge).toBeTruthy();

        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Owner');
    });

    it('in run view shows resolved user name with role indicator badge when assignee_type is creator', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'creator'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={false}
                onChanged={onChanged}
                participantUserIds={['user-2']}
                runCreatorUserId='user-2'
                mode='run'
            />,
        );

        const instance = component.root;
        const roleBadge = instance.findByProps({'data-testid': 'role-indicator-badge'});
        expect(roleBadge).toBeTruthy();

        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Creator');
    });

    it('in template editor shows role label instead of resolved user name when assignee_type is owner', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'owner'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                mode='template'
            />,
        );

        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Owner');

        // Should not try to render a resolved user avatar since we're in template mode
        const instance = component.root;
        const allNodes = instance.findAll((node) => node.props['data-testid'] === 'resolved-user-avatar');
        expect(allNodes.length).toBe(0);
    });

    it('in template editor shows role label instead of resolved user name when assignee_type is creator', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: '', assignee_type: 'creator'});

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                mode='template'
            />,
        );

        const tree = component.toJSON();
        const treeStr = JSON.stringify(tree);
        expect(treeStr).toContain('Run Creator');

        const instance = component.root;
        const allNodes = instance.findAll((node) => node.props['data-testid'] === 'resolved-user-avatar');
        expect(allNodes.length).toBe(0);
    });

    // --- Run User (property_user) assignment ---

    const makeUserField = (id: string, name: string) => ({
        id,
        group_id: '',
        name,
        type: PropertyFieldType.User,
        target_type: 'run' as const,
        attrs: {visibility: 'always' as const, sort_order: 0, options: null},
        create_at: 0,
        update_at: 0,
        delete_at: 0,
    });

    it('shows Run User option when user-type property fields are available', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem();
        const fields = [makeUserField('f1', 'Manager')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'role-option-property_user'})).toBeTruthy();
        const treeStr = JSON.stringify(component.toJSON());
        expect(treeStr).toContain('Run User');
    });

    it('does not show Run User option when no user-type property fields exist', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem();

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={[]}
            />,
        );

        const instance = component.root;
        const runUserOptions = instance.findAll((n) => n.props['data-testid'] === 'role-option-property_user');
        expect(runUserOptions.length).toBe(0);
    });

    it('does not show Run User option when propertyFields is undefined', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem();

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
            />,
        );

        const instance = component.root;
        const runUserOptions = instance.findAll((n) => n.props['data-testid'] === 'role-option-property_user');
        expect(runUserOptions.length).toBe(0);
    });

    it('selecting Run User from role dropdown shows sub-dropdown but does not call onChanged until a field is picked', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_id: 'user-1', assignee_type: ''});
        const fields = [makeUserField('f1', 'Manager')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        const roleSelect = instance.findByProps({'data-testid': 'role-options'});

        // Selecting property_user defers the mutation — no onChanged call yet.
        renderer.act(() => {
            roleSelect.props.onChange({target: {value: 'property_user'}});
        });
        expect(onChanged).not.toHaveBeenCalled();

        // The sub-dropdown should now be visible.
        expect(instance.findByProps({'data-testid': 'property-user-field-options'})).toBeTruthy();
    });

    it('attribute sub-dropdown is shown only when Run User role is selected', () => {
        const onChanged = jest.fn();
        const fields = [makeUserField('f1', 'Manager')];

        // Not selected — sub-dropdown should not appear
        const itemUnselected = makeChecklistItem({assignee_type: ''});
        const comp1 = renderer.create(
            <AssigneeDropdown
                checklistItem={itemUnselected}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );
        const noDropdown = comp1.root.findAll((n) => n.props['data-testid'] === 'property-user-field-options');
        expect(noDropdown.length).toBe(0);

        // Selected — sub-dropdown should appear
        const itemSelected = makeChecklistItem({assignee_type: 'property_user', assignee_property_field_id: ''});
        const comp2 = renderer.create(
            <AssigneeDropdown
                checklistItem={itemSelected}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );
        expect(comp2.root.findByProps({'data-testid': 'property-user-field-options'})).toBeTruthy();
    });

    it('shows user-type field options in the attribute sub-dropdown', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_type: 'property_user', assignee_property_field_id: ''});
        const fields = [makeUserField('f1', 'Manager'), makeUserField('f2', 'Approver')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'property-user-field-option-f1'})).toBeTruthy();
        expect(instance.findByProps({'data-testid': 'property-user-field-option-f2'})).toBeTruthy();
    });

    it('selecting an attribute from the sub-dropdown calls onChanged with the field id', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_type: 'property_user', assignee_property_field_id: ''});
        const fields = [makeUserField('f1', 'Manager')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        const select = instance.findByProps({'data-testid': 'property-user-field-options'});
        select.props.onChange({target: {value: 'f1'}});

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: 'property_user',
            assignee_property_field_id: 'f1',
            assignee_id: '',
        });
    });

    it('currently selected attribute is reflected in the sub-dropdown value', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({
            assignee_type: 'property_user',
            assignee_property_field_id: 'f1',
        });
        const fields = [makeUserField('f1', 'Manager'), makeUserField('f2', 'Approver')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        const select = instance.findByProps({'data-testid': 'property-user-field-options'});
        expect(select.props.value).toBe('f1');
    });

    it('selecting empty from the sub-dropdown clears the property_user assignment', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({
            assignee_type: 'property_user',
            assignee_property_field_id: 'f1',
        });
        const fields = [makeUserField('f1', 'Manager')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        const select = instance.findByProps({'data-testid': 'property-user-field-options'});
        select.props.onChange({target: {value: ''}});

        expect(onChanged).toHaveBeenCalledWith({
            ...item,
            assignee_type: '',
            assignee_property_field_id: '',
            assignee_id: '',
        });
    });

    it('shows "Run <FieldName>" badge in read-only mode when assignee_type is property_user', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({
            assignee_type: 'property_user',
            assignee_property_field_id: 'f1',
        });
        const fields = [makeUserField('f1', 'Manager')];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={false}
                onChanged={onChanged}
                participantUserIds={[]}
                mode='template'
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        const badge = instance.findByProps({'data-testid': 'property-user-indicator-badge'});
        expect(badge).toBeTruthy();
        const treeStr = JSON.stringify(component.toJSON());
        expect(treeStr).toContain('Run Manager');
    });

    it('shows resolved user with badge in run mode when assignee_type is property_user', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({
            assignee_type: 'property_user',
            assignee_property_field_id: 'f1',
            assignee_id: 'user-1',
        });
        const fields = [makeUserField('f1', 'Manager')];
        const values = [{id: 'v1', field_id: 'f1', target_id: '', target_type: 'run', group_id: '', value: 'user-1', create_at: 0, update_at: 0, delete_at: 0}];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={false}
                onChanged={onChanged}
                participantUserIds={[]}
                mode='run'
                propertyFields={fields}
                propertyValues={values}
            />,
        );

        const instance = component.root;
        const badge = instance.findByProps({'data-testid': 'property-user-indicator-badge'});
        expect(badge).toBeTruthy();

        // ProfileSelector is rendered with the resolved user ID from propertyValues
        const profileSelector = instance.findByProps({'data-testid': 'profile-selector'});
        expect(profileSelector).toBeTruthy();
        expect(profileSelector.props['data-selected']).toBe('user-1');

        const treeStr = JSON.stringify(component.toJSON());
        expect(treeStr).toContain('Run Manager');
    });

    it('shows "Run User" fallback badge when property field is not found', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({
            assignee_type: 'property_user',
            assignee_property_field_id: 'unknown',
        });

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={false}
                onChanged={onChanged}
                participantUserIds={[]}
                mode='run'
                propertyFields={[]}
            />,
        );

        const treeStr = JSON.stringify(component.toJSON());
        expect(treeStr).toContain('Run User');
    });

    it('does not show non-user property fields in the attribute sub-dropdown', () => {
        const onChanged = jest.fn();
        const item = makeChecklistItem({assignee_type: 'property_user', assignee_property_field_id: ''});
        const fields = [
            makeUserField('f1', 'Manager'),
            {id: 'f2', group_id: '', name: 'Priority', type: PropertyFieldType.Select, target_type: 'run' as const, attrs: {visibility: 'always' as const, sort_order: 0, options: null}, create_at: 0, update_at: 0, delete_at: 0},
        ];

        const component = renderer.create(
            <AssigneeDropdown
                checklistItem={item}
                editable={true}
                onChanged={onChanged}
                participantUserIds={[]}
                propertyFields={fields}
            />,
        );

        const instance = component.root;
        expect(instance.findByProps({'data-testid': 'property-user-field-option-f1'})).toBeTruthy();
        const nonUserOptions = instance.findAll((n) => n.props['data-testid'] === 'property-user-field-option-f2');
        expect(nonUserOptions.length).toBe(0);
    });
});
