// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import ProfileSelector from 'src/components/profile/profile_selector';
import {useProfilesInTeam} from 'src/hooks';
import {
    AssigneeTypeCreator,
    AssigneeTypeOwner,
    AssigneeTypePropertyUser,
    ChecklistItem,
    isRoleBasedAssigneeType,
} from 'src/types/playbook';

import {PropertyField, PropertyFieldType, PropertyValue} from 'src/types/properties';

const ROLE_NONE = 'none';

interface Props {
    checklistItem: ChecklistItem;
    editable: boolean;
    onChanged: (item: ChecklistItem) => void;
    participantUserIds: string[];
    runOwnerUserId?: string;
    runCreatorUserId?: string;
    mode?: 'template' | 'run';
    propertyFields?: PropertyField[];
    propertyValues?: PropertyValue[];
}

const AssigneeDropdown = ({checklistItem, editable, onChanged, participantUserIds, runOwnerUserId, runCreatorUserId, mode, propertyFields, propertyValues}: Props) => {
    const {formatMessage} = useIntl();
    const profilesInTeam = useProfilesInTeam();
    const [pendingPropertyUser, setPendingPropertyUser] = useState<boolean>(false);

    const assigneeType = checklistItem.assignee_type || '';

    const selectedRole = isRoleBasedAssigneeType(assigneeType) ? assigneeType : ROLE_NONE;

    // When the property_user radio is clicked but no field has been selected yet,
    // show it as selected in the UI without firing a mutation.
    const displayRole = pendingPropertyUser ? AssigneeTypePropertyUser : selectedRole;

    const handleRoleRadioChange = useCallback((value: string) => {
        if (value === AssigneeTypePropertyUser) {
            // Defer the mutation until a field is actually selected in the sub-dropdown.
            setPendingPropertyUser(true);
            return;
        }
        setPendingPropertyUser(false);
        onChanged({
            ...checklistItem,
            assignee_type: value === ROLE_NONE ? '' : value,
            assignee_id: '',
            assignee_property_field_id: '',
        });
    }, [checklistItem, onChanged]);

    const handlePropertyUserFieldChange = useCallback((fieldId: string) => {
        setPendingPropertyUser(false);
        onChanged({
            ...checklistItem,
            assignee_type: fieldId ? AssigneeTypePropertyUser : '',
            assignee_id: '',
            assignee_property_field_id: fieldId,
        });
    }, [checklistItem, onChanged]);

    const getAllUsersInTeam = useCallback(async () => profilesInTeam, [profilesInTeam]);

    const handleUserSelect = useCallback((user?: {id: string}) => {
        setPendingPropertyUser(false);
        onChanged({
            ...checklistItem,
            assignee_type: '',
            assignee_id: user?.id ?? '',
            assignee_property_field_id: '',
        });
    }, [checklistItem, onChanged]);

    const userPropertyFields = useMemo(
        () => propertyFields?.filter((f) => f.type === PropertyFieldType.User) ?? [],
        [propertyFields],
    );

    // Read-only view: show a role badge and the resolved user avatar (if in run mode).
    if (!editable && isRoleBasedAssigneeType(assigneeType)) {
        let resolvedUserId: string | undefined;
        let badgeLabel: string;
        let badgeTestId: string;

        if (assigneeType === AssigneeTypePropertyUser) {
            const field = propertyFields?.find((f) => f.id === checklistItem.assignee_property_field_id);
            badgeLabel = field ? formatMessage({defaultMessage: 'Run {name}'}, {name: field.name}) : formatMessage({defaultMessage: 'Run User'});
            badgeTestId = 'property-user-indicator-badge';
            if (mode === 'run') {
                const pv = propertyValues?.find((v) => v.field_id === checklistItem.assignee_property_field_id);
                if (pv?.value && typeof pv.value === 'string') {
                    resolvedUserId = pv.value;
                } else if (checklistItem.assignee_id) {
                    resolvedUserId = checklistItem.assignee_id;
                }
            }
        } else {
            badgeLabel = assigneeType === AssigneeTypeOwner ? formatMessage({defaultMessage: 'Run Owner'}) : formatMessage({defaultMessage: 'Run Creator'});
            badgeTestId = 'role-indicator-badge';
            if (mode === 'run') {
                resolvedUserId = checklistItem.assignee_id || (assigneeType === AssigneeTypeOwner ? runOwnerUserId : runCreatorUserId);
            }
        }

        return (
            <Container>
                {resolvedUserId && (
                    <CompactProfileSelector
                        selectedUserId={resolvedUserId}
                        placeholder={formatMessage({defaultMessage: 'Assignee...'})}
                        enableEdit={false}
                        getAllUsers={getAllUsersInTeam}
                        selfIsFirstOption={false}
                    />
                )}
                <RoleBadge data-testid={badgeTestId}>
                    {badgeLabel}
                </RoleBadge>
            </Container>
        );
    }

    const roleOptions = [
        {value: ROLE_NONE, displayLabel: formatMessage({defaultMessage: 'None'})},
        {value: AssigneeTypeOwner, displayLabel: formatMessage({defaultMessage: 'Run Owner \u2014 Resolves to run owner at creation'})},
        {value: AssigneeTypeCreator, displayLabel: formatMessage({defaultMessage: 'Run Creator \u2014 Resolves to run creator at creation'})},
        ...(userPropertyFields.length > 0 ? [{
            value: AssigneeTypePropertyUser,
            displayLabel: formatMessage({defaultMessage: 'Run User \u2014 Resolves to a user-type attribute at creation'}),
        }] : []),
    ];

    return (
        <Container>
            <SectionLabel>{formatMessage({defaultMessage: 'ASSIGN TO A PERSON'})}</SectionLabel>
            <ProfileSelector
                testId={'assignee-profile-selector'}
                selectedUserId={checklistItem.assignee_id}
                placeholder={formatMessage({defaultMessage: 'Assignee...'})}
                enableEdit={editable}
                getAllUsers={getAllUsersInTeam}
                onSelectedChange={handleUserSelect}
                selfIsFirstOption={true}
                userGroups={{
                    subsetUserIds: participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                }}
            />
            <Divider/>
            <SectionLabel>{formatMessage({defaultMessage: 'ASSIGN TO A ROLE'})}</SectionLabel>
            <SelectWrapper>
                <AssigneeSelect
                    data-testid='role-options'
                    aria-label={formatMessage({defaultMessage: 'Select role for assignee'})}
                    value={displayRole}
                    onChange={editable ? (e) => handleRoleRadioChange(e.target.value) : undefined}
                    disabled={!editable}
                >
                    {roleOptions.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                            data-testid={`role-option-${opt.value}`}
                        >
                            {opt.displayLabel}
                        </option>
                    ))}
                </AssigneeSelect>
            </SelectWrapper>
            {displayRole === AssigneeTypePropertyUser && (
                <SelectWrapper>
                    <AssigneeSelect
                        data-testid='property-user-field-options'
                        aria-label={formatMessage({defaultMessage: 'Select property field for assignee'})}
                        value={checklistItem.assignee_property_field_id ?? ''}
                        onChange={editable ? (e) => handlePropertyUserFieldChange(e.target.value) : undefined}
                        disabled={!editable}
                    >
                        <option value=''>{formatMessage({defaultMessage: 'Select attribute...'})}</option>
                        {userPropertyFields.map((f) => (
                            <option
                                key={f.id}
                                value={f.id}
                                data-testid={`property-user-field-option-${f.id}`}
                            >
                                {f.name}
                            </option>
                        ))}
                    </AssigneeSelect>
                </SelectWrapper>
            )}
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const SectionLabel = styled.div`
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding: 4px 8px 2px;
`;

const Divider = styled.div`
    height: 1px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    margin: 4px 0;
`;

const SelectWrapper = styled.div`
    padding: 2px 8px 6px;
`;

const AssigneeSelect = styled.select`
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background-color: var(--center-channel-bg);
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    color: var(--center-channel-color);
    font-size: 13px;
    cursor: pointer;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
        outline: none;
    }
`;

const CompactProfileSelector = styled(ProfileSelector)`
    .PlaybookRunProfileButton {
        height: 24px;
        padding: 2px 6px 2px 2px;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        border-radius: 100px;

        .image {
            width: 20px;
            height: 20px;
        }

        .PlaybookRunProfile {
            font-size: 12px;
            font-weight: 400;
            line-height: 10px;
        }
    }
`;

const RoleBadge = styled.span`
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    color: rgba(var(--button-bg-rgb), 1);
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    white-space: nowrap;
`;

export default AssigneeDropdown;
