// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import ReactSelect, {ControlProps, GroupType} from 'react-select';

import styled from 'styled-components';
import {Group} from '@mattermost/types/groups';
import {Client4} from 'mattermost-redux/client';

import {FormattedMessage, useIntl} from 'react-intl';
import debounce from 'debounce';

import MenuList from 'src/components/backstage/playbook_edit/automation/menu_list';

interface Props {
    groupIds: string[];
    onAddGroup: (groupId: string) => void;
    onRemoveGroup: (groupId: string) => void;
    isDisabled: boolean;
}

const InviteGroupsSelector = (props: Props) => {
    const {formatMessage} = useIntl();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSetSearchTerm = useMemo(() => debounce(setSearchTerm, 300), []);
    const [invitedGroups, setInvitedGroups] = useState<Group[]>([]);
    const [searchedGroups, setSearchedGroups] = useState<Group[]>([]);

    // Fetch invited groups by their IDs
    useEffect(() => {
        const fetchInvitedGroups = async () => {
            const results = await Promise.allSettled(
                props.groupIds.map((groupId) => Client4.getGroup(groupId, true)),
            );
            const groups = results
                .filter((r): r is PromiseFulfilledResult<Group> => r.status === 'fulfilled' && r.value != null)
                .map((r) => r.value);
            setInvitedGroups(groups);
        };

        fetchInvitedGroups();
    }, [props.groupIds]);

    // Search groups when search term changes
    useEffect(() => {
        const searchGroups = async () => {
            try {
                const groups = await Client4.searchGroups({
                    q: searchTerm,
                    filter_allow_reference: true,
                    page: 0,
                    per_page: 60,
                    include_member_count: true,
                });
                setSearchedGroups(groups || []);
            } catch {
                setSearchedGroups([]);
            }
        };

        searchGroups();
    }, [searchTerm]);

    let invitedGroupsList: Group[] = [];
    let nonInvitedGroups: Group[] = [];

    if (searchTerm.trim().length === 0) {
        invitedGroupsList = invitedGroups.filter((g) => g);
        nonInvitedGroups = searchedGroups.filter(
            (group: Group) => !props.groupIds.includes(group.id),
        );
    } else {
        searchedGroups.forEach((group: Group) => {
            if (props.groupIds.includes(group.id)) {
                invitedGroupsList.push(group);
            } else {
                nonInvitedGroups.push(group);
            }
        });
    }

    let options: Group[] | GroupType<Group>[] = nonInvitedGroups;
    if (invitedGroupsList.length !== 0) {
        options = [
            {label: 'SELECTED', options: invitedGroupsList},
            {label: 'ALL', options: nonInvitedGroups},
        ];
    }

    let badgeContent = '';
    const numInvitedGroups = props.groupIds.length;
    if (numInvitedGroups > 0) {
        badgeContent = `${numInvitedGroups} SELECTED`;
    }

    const isGroup = (option: Group | GroupType<Group>): option is GroupType<Group> => (
        (option as GroupType<Group>).label !== undefined && typeof (option as GroupType<Group>).label === 'string' && 'options' in (option as GroupType<Group>)
    );

    return (
        <StyledReactSelect
            badgeContent={badgeContent}
            closeMenuOnSelect={false}
            onInputChange={debouncedSetSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            controlShouldRenderValue={false}
            onChange={(groupAdded: Group) => props.onAddGroup(groupAdded.id)}
            getOptionValue={(group: Group) => group.id}
            formatOptionLabel={(option: Group) => (
                <GroupLabel
                    onRemove={() => props.onRemoveGroup(option.id)}
                    group={option}
                    invitedGroups={(options.length > 0 && isGroup(options[0])) ? options[0].options : []}
                />
            )}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={formatMessage({defaultMessage: 'Search for groups'})}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<Group, boolean>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='invite-groups-selector'
            captureMenuScroll={false}
        />
    );
};

export default InviteGroupsSelector;

interface GroupLabelProps {
    onRemove: () => void;
    group: Group;
    invitedGroups: Group[];
}

const GroupLabel = (props: GroupLabelProps) => {
    let icon = <PlusIcon/>;
    if (props.invitedGroups.find((g: Group) => g.id === props.group.id)) {
        icon = <Remove onClick={props.onRemove}><FormattedMessage defaultMessage='Remove'/></Remove>;
    }

    return (
        <>
            <GroupInfo>
                <GroupIcon className='icon icon-account-multiple-outline'/>
                <GroupName>{props.group.display_name}</GroupName>
                {props.group.source === 'ldap' && (
                    <LinkedIcon className='icon icon-link-variant'/>
                )}
                {props.group.member_count !== undefined && (
                    <MemberCount>
                        <FormattedMessage
                            defaultMessage='{count} {count, plural, one {member} other {members}}'
                            values={{count: props.group.member_count}}
                        />
                    </MemberCount>
                )}
            </GroupInfo>
            {icon}
        </>
    );
};

const GroupInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
`;

const GroupIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 16px;
`;

const GroupName = styled.span`
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const LinkedIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.48);
    font-size: 14px;
    flex-shrink: 0;
`;

const MemberCount = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    white-space: nowrap;
`;

const Remove = styled.span`
    display: inline-block;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    font-weight: 600;
    line-height: 9px;

    &:hover {
        cursor: pointer;
    }
`;

const PlusIcon = styled.i`
    /* Only shows on hover, controlled in the style from
    .invite-groups-selector__option--is-focused */
    display: none;

    &::before {
        color: var(--button-bg);
        content: "\f0415";
        font-family: compass-icons;
        font-size: 14.4px;
        font-style: normal;
        line-height: 17px;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(selectProps) => (selectProps.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .invite-groups-selector__input {
        color: var(--center-channel-color);
    }

    .invite-groups-selector__menu {
        background-color: transparent;
        box-shadow: 0 8px 24px rgba(0 0 0 / 0.12);
    }

    .invite-groups-selector__option {
        display: flex;
        height: 36px;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 6px 21px 6px 12px;

        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }

    .invite-groups-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .invite-groups-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);

        ${PlusIcon} {
            display: inline-block;
        }
    }

    .invite-groups-selector__control {
        width: 100%;
        height: 4rem;
        padding-right: 16px;
        padding-left: 3.2rem;
        border: none;
        border-radius: 4px;
        background-color: transparent;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        font-size: 14px;
        transition: all 0.15s ease;
        transition-delay: 0s;

        &--is-focused {
            box-shadow: inset 0 0 0 2px var(--button-bg);
        }

        &::before {
            position: absolute;
            top: 8px;
            left: 16px;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-family: compass-icons, mattermosticons;
            font-size: 18px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        &::after {
            padding: 0 4px;
            border-radius: 4px;

            /* Light / 8% Center Channel Text */
            background: rgba(var(--center-channel-color-rgb), 0.08);
            content: '${(selectProps) => !selectProps.isDisabled && selectProps.badgeContent}';
            font-size: 10px;
            font-weight: 600;
            line-height: 16px;
        }
    }

    .invite-groups-selector__group-heading {
        height: 32px;
        padding: 8px 12px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
    }
`;
