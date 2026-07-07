// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import styled, {css} from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {ControlProps, components} from 'react-select';
import {UserProfile} from '@mattermost/types/users';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {Placement} from '@floating-ui/react';

import {AccountOutlineIcon} from '@mattermost/compass-icons/components';

import Profile from 'src/components/profile/profile';
import ProfileSelector, {type ExtraSection, Option} from 'src/components/profile/profile_selector';
import {useProfilesForRun} from 'src/hooks';
import {ChecklistHoverMenuButton} from 'src/components/rhs/rhs_shared';
import {AssigneeTypeOwner, AssigneeTypePropertyUser, isRoleBasedAssigneeType} from 'src/types/playbook';
import {PropertyField, PropertyValue} from 'src/types/properties';

export const EXTRA_OPTION_PREFIX_ROLE = 'role:';
export const EXTRA_OPTION_PREFIX_PROPERTY_USER = 'property_user:';

export interface RoleOption {
    value: string;
    label: string;
}

const AVATAR_SIZE_PX = 24;
const CHIP_HEIGHT_PX = 28;
const CHIP_ROLE_ICON_SIZE_PX = 16;

const assigneeDropdownContainerStyles = css`
    .playbook-react-select .image {
        width: ${AVATAR_SIZE_PX}px;
        height: ${AVATAR_SIZE_PX}px;
    }
`;

const RoleUserAvatarIcon = ({variant}: {variant: 'chip' | 'dropdown'}) => {
    if (variant === 'dropdown') {
        return (
            <DropdownRoleAvatarIcon aria-hidden={true}>
                <AccountOutlineIcon size={16}/>
            </DropdownRoleAvatarIcon>
        );
    }

    return (
        <ChipRoleAvatarIcon aria-hidden={true}>
            <AccountOutlineIcon size={CHIP_ROLE_ICON_SIZE_PX}/>
        </ChipRoleAvatarIcon>
    );
};

interface AssignedToProps {
    assignee_id: string;
    assignee_type?: string;
    assignee_property_field_id?: string;
    participantUserIds: string[];
    editable: boolean;
    inHoverMenu?: boolean;
    placement?: Placement;
    onSelectedChange?: (user?: UserProfile) => void;
    onExtraOptionSelected?: (value: string) => void;
    onOpenChange?: (isOpen: boolean) => void;
    isEditing?: boolean;
    roleOptions?: RoleOption[];
    teamId?: string;
    channelId?: string;
    propertyFields?: PropertyField[];
    propertyValues?: PropertyValue[];
    runOwnerUserId?: string;
    runCreatorUserId?: string;
    mode?: 'template' | 'run';
}

const AssignTo = (props: AssignedToProps) => {
    const {formatMessage} = useIntl();
    const profiles = useProfilesForRun(props.teamId, props.channelId);
    const [profileSelectorToggle, setProfileSelectorToggle] = useState(false);

    // For DM/GM runs (empty teamId), profiles are loaded async from channel membership.
    // Use a key to force ProfileSelector to re-fetch when profiles become available.
    // TODO: Consider adding a refreshTrigger prop to ProfileSelector for cleaner cache invalidation.
    const isDMGM = !props.teamId && props.channelId;
    const profilesKey = isDMGM ? `dmgm-${profiles.length}` : 'team';

    const resetAssignee = () => {
        props.onSelectedChange?.();
        setProfileSelectorToggle(!profileSelectorToggle);
    };

    const extraSections: ExtraSection[] = [];
    if (props.roleOptions && props.roleOptions.length > 0) {
        extraSections.push({
            label: formatMessage({defaultMessage: 'RUN ROLES'}),
            options: props.roleOptions.map((r) => ({
                value: r.value,
                label: (
                    <OptionRow>
                        <RoleUserAvatarIcon variant='dropdown'/>
                        {r.label}
                    </OptionRow>
                ),
                isExtraOption: true as const,
            })),
        });
    }

    const roleAssigneeDisplay = useMemo(() => {
        const assigneeType = props.assignee_type || '';
        if (!isRoleBasedAssigneeType(assigneeType)) {
            return null;
        }

        let label: string;
        let resolvedUserId: string | undefined;
        let badgeTestId: string;

        if (assigneeType === AssigneeTypePropertyUser) {
            const field = props.propertyFields?.find((f) => f.id === props.assignee_property_field_id);
            label = field ? formatMessage({defaultMessage: 'Run {name}'}, {name: field.name}) : formatMessage({defaultMessage: 'Run User'});
            badgeTestId = 'property-user-indicator-badge';
            if (props.mode === 'run') {
                const propertyValue = props.propertyValues?.find((v) => v.field_id === props.assignee_property_field_id);
                if (propertyValue?.value && typeof propertyValue.value === 'string') {
                    resolvedUserId = propertyValue.value;
                } else if (props.assignee_id) {
                    resolvedUserId = props.assignee_id;
                }
            }
        } else {
            label = assigneeType === AssigneeTypeOwner ? formatMessage({defaultMessage: 'Run Owner'}) : formatMessage({defaultMessage: 'Run Creator'});
            badgeTestId = 'role-indicator-badge';
            if (props.mode === 'run') {
                resolvedUserId = props.assignee_id || (assigneeType === AssigneeTypeOwner ? props.runOwnerUserId : props.runCreatorUserId);
            }
        }

        if (resolvedUserId) {
            return (
                <RoleAssigneeDisplay>
                    <Profile
                        userId={resolvedUserId}
                        nameFormatter={(preferredName) => (
                            <>
                                {preferredName}
                                <RolePillLabel data-testid={badgeTestId}>{label}</RolePillLabel>
                            </>
                        )}
                    />
                </RoleAssigneeDisplay>
            );
        }

        return (
            <RoleAssigneeDisplay data-testid={badgeTestId}>
                <RolePillContent>
                    <RoleUserAvatarIcon variant='chip'/>
                    <RolePillLabel>{label}</RolePillLabel>
                </RolePillContent>
            </RoleAssigneeDisplay>
        );
    }, [
        props.assignee_type,
        props.assignee_property_field_id,
        props.assignee_id,
        props.propertyFields,
        props.propertyValues,
        props.runOwnerUserId,
        props.runCreatorUserId,
        props.mode,
        formatMessage,
    ]);

    const profileSelectorProps = {
        selectedUserId: roleAssigneeDisplay ? undefined : props.assignee_id,
        assignedDisplay: roleAssigneeDisplay ?? undefined,
    };

    if (props.inHoverMenu) {
        return (
            <ProfileSelector
                key={profilesKey}
                {...profileSelectorProps}
                dropdownContainerStyles={assigneeDropdownContainerStyles}
                onlyPlaceholder={true}
                placeholder={
                    <ChecklistHoverMenuButton
                        title={formatMessage({defaultMessage: 'Assign'})}
                        className={'icon-account-plus-outline icon-12 btn-icon'}
                    />
                }
                enableEdit={true}
                userGroups={{
                    subsetUserIds: props.participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                }}
                getAllUsers={async () => {
                    return profiles;
                }}
                onSelectedChange={props.onSelectedChange}
                onExtraOptionSelected={props.onExtraOptionSelected}
                extraSections={extraSections.length > 0 ? extraSections : undefined}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id) || Boolean(props.assignee_type),
                    onCustomReset: resetAssignee,
                }}
                controlledOpenToggle={profileSelectorToggle}
                placement={props.placement}
                onOpenChange={props.onOpenChange}
            />
        );
    }

    const dropdownArrow = (
        <DropdownArrow className={'icon-chevron-down icon--small ml-1'}/>
    );

    let assignToButton = (
        <AssignToContainer>
            <StyledProfileSelector
                key={profilesKey}
                testId={'assignee-profile-selector'}
                {...profileSelectorProps}
                userGroups={{
                    subsetUserIds: props.participantUserIds,
                    defaultLabel: formatMessage({defaultMessage: 'NOT PARTICIPATING'}),
                    subsetLabel: formatMessage({defaultMessage: 'PARTICIPANTS'}),
                }}
                placeholder={
                    <PlaceholderDiv>
                        <AssignToIcon
                            className={'icon-account-plus-outline icon-12'}
                        />
                        {!props.isEditing && (
                            <AssignToTextContainer
                                isPlaceholder={!props.assignee_id}
                                enableEdit={props.editable}
                            >
                                {formatMessage({defaultMessage: 'Assignee...'})}
                            </AssignToTextContainer>
                        )}
                    </PlaceholderDiv>
                }
                placeholderButtonClass={'NoAssignee-button'}
                profileButtonClass={'Assigned-button'}
                enableEdit={props.editable}
                getAllUsers={async () => {
                    return profiles;
                }}
                onSelectedChange={props.onSelectedChange}
                onExtraOptionSelected={props.onExtraOptionSelected}
                extraSections={extraSections.length > 0 ? extraSections : undefined}
                selfIsFirstOption={true}
                customControl={ControlComponent}
                customControlProps={{
                    showCustomReset: Boolean(props.assignee_id) || Boolean(props.assignee_type),
                    onCustomReset: resetAssignee,
                }}
                customDropdownArrow={dropdownArrow}
                placement={props.placement}
                onOpenChange={props.onOpenChange}
            />
        </AssignToContainer>
    );

    if (props.isEditing && !props.assignee_id && !props.assignee_type) {
        assignToButton = (
            <WithTooltip
                id='assignee-tooltip'
                title={formatMessage({defaultMessage: 'Assignee'})}
            >
                {assignToButton}
            </WithTooltip>
        );
    }

    return assignToButton;
};

export default AssignTo;

const ControlComponent = (ownProps: ControlProps<Option, boolean>) => (
    <div>
        <components.Control {...ownProps}/>
        {ownProps.selectProps.showCustomReset && (
            <ControlComponentAnchor onClick={ownProps.selectProps.onCustomReset}>
                <FormattedMessage defaultMessage='No Assignee'/>
            </ControlComponentAnchor>
        )}
    </div>
);

const StyledProfileSelector = styled(ProfileSelector).attrs({
    dropdownContainerStyles: assigneeDropdownContainerStyles,
})`
    .Assigned-button, .NoAssignee-button, .NoName-Assigned-button {
        display: flex;
        align-items: center;
        max-width: 100%;
        padding: 2px 6px 2px 4px;
        margin-top: 0;
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
        border-radius: 100px;
        border: none;
        font-weight: 400;
        font-size: 12px;
        line-height: 10px;
        box-sizing: border-box;

        ${({enableEdit}) => enableEdit && css`
            &:hover {
                background: rgba(var(--center-channel-color-rgb), 0.16);
            }
        `}

        .image {
            width: ${AVATAR_SIZE_PX}px;
            height: ${AVATAR_SIZE_PX}px;
        }

        .icon-chevron-down{
            display: flex;
            align-items: center;
            font-size: 14.4px;
            font-weight: 400;
            line-height: 14px;
            text-align: center;
        }
    }

    .Assigned-button, .NoName-Assigned-button {
        height: ${CHIP_HEIGHT_PX}px;
    }

    .NoName-Assigned-button {
        padding: 0 6px 0 0;

        .image {
            margin: 2px;
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .NoAssignee-button {
        background-color: transparent;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.64);
        padding: 2px;

        ${({enableEdit}) => enableEdit && css`
            &:hover {
                color: var(--center-channel-color);
            }
        `}
    }
`;

const PlaceholderDiv = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;

const AssignToTextContainer = styled.div<{isPlaceholder: boolean, enableEdit: boolean}>`
    color: ${({isPlaceholder}) => (isPlaceholder ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--center-channel-color)')};
     ${({enableEdit}) => enableEdit && css`
        &:hover {
            color: var(--center-channel-color);
        }
    `}
    font-weight: 400;
    font-size: 12px;
    line-height: 15px;
    margin-left: 5px;
`;

const AssignToIcon = styled.i`
    display: flex;
    width: 20px;
    height: 20px;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb),0.56);
    text-align: center;
`;

export const AssignToContainer = styled.div`
    display: flex;
`;

const ControlComponentAnchor = styled.a`
    position: relative;
    top: -4px;
    display: inline-block;
    margin: 0 0 8px 12px;
    font-size: 12px;
    font-weight: 600;
`;

export const DropdownArrow = styled.i`
    color: var(--center-channel-color-32);
`;

const OptionRow = styled.div`
    display: flex;
    align-items: center;
    width: 100%;
    gap: 8px;
`;

const DropdownRoleAvatarIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${AVATAR_SIZE_PX}px;
    height: ${AVATAR_SIZE_PX}px;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ChipRoleAvatarIcon = styled.span`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: ${AVATAR_SIZE_PX}px;
    height: ${AVATAR_SIZE_PX}px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const RoleAssigneeDisplay = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;
`;

const RolePillContent = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
`;

const RolePillLabel = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 15px;
`;
