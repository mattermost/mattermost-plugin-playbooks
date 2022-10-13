// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';

import {Placement} from '@floating-ui/react-dom-interactions';

import {useUpdateEffect} from 'react-use';

import styled from 'styled-components';

import Profile from 'src/components/profile/profile';
import ProfileButton from 'src/components/profile/profile_button';
import {PlaybookRunFilterButton} from '../backstage/styles';
import Dropdown from 'src/components/dropdown';

export interface Option {
    value: string;
    label: JSX.Element | string;
    userType: string;
    user: UserProfile;
}

interface ActionObj {
    action: ActionTypes;
}

interface Props {
    testId?: string
    selectedUserId?: string;
    placeholder: React.ReactNode;
    placeholderButtonClass?: string;
    profileButtonClass?: string;
    onlyPlaceholder?: boolean;
    enableEdit: boolean;
    onEditDisabledClick?: () => void
    isClearable?: boolean;
    customControl?: (props: ControlProps<Option, boolean>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    withoutProfilePic?: boolean;
    defaultValue?: string;
    selfIsFirstOption?: boolean;
    getUsers: () => Promise<UserProfile[]>;
    getUsersInTeam: () => Promise<UserProfile[]>;
    onSelectedChange?: (userType?: string, user?: UserProfile) => void;
    customControlProps?: any;
    placement?: Placement;
    className?: string;
    selectWithoutName?: boolean;
    customDropdownArrow?: React.ReactNode;
    onOpenChange?: (isOpen: boolean) => void;
}

export default function ProfileSelector(props: Props) {
    const currentUserId = useSelector<GlobalState, string>(getCurrentUserId);
    const {formatMessage} = useIntl();

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        if (!isOpen) {
            fetchUsers();
        }
        setOpen(!isOpen);
    };

    useUpdateEffect(() => {
        props.onOpenChange?.(isOpen);
    }, [isOpen]);

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const [userOptions, setUserOptions] = useState<Option[]>([]);
    const [userNotInChannelOptions, setUserNotInChannelOptions] = useState<Option[]>([]);

    async function fetchUsers() {
        const nameAsText = (userName: string, firstName: string, lastName: string, nickName: string): string => {
            return '@' + userName + getUserDescription(firstName, lastName, nickName);
        };

        const needsSuffix = (userId: string) => {
            return props.selfIsFirstOption && userId === currentUserId;
        };

        const [users, usersInTeam] = await Promise.all([props.getUsers(), props.getUsersInTeam()]);
        const usersNotInChannel = usersInTeam.filter((user) => !users.includes(user));

        const optionNotInTeamList = usersNotInChannel.map((user: UserProfile) => {
            return ({
                value: nameAsText(user.username, user.first_name, user.last_name, user.nickname),
                label: (
                    <Profile
                        userId={user.id}
                        nameFormatter={needsSuffix(user.id) ? formatProfileName(' (assign to me)') : formatProfileName('')}
                    />
                ),
                userType: 'NonMember',
                user,
            } as Option);
        });

        const optionList = users.map((user: UserProfile) => {
            return ({
                value: nameAsText(user.username, user.first_name, user.last_name, user.nickname),
                label: (
                    <Profile
                        userId={user.id}
                        nameFormatter={needsSuffix(user.id) ? formatProfileName(' (assign to me)') : formatProfileName('')}
                    />
                ),
                userType: 'Member',
                user,
            } as Option);
        });

        if (props.selfIsFirstOption) {
            const idx = optionList.findIndex((elem) => elem.user.id === currentUserId);
            if (idx > 0) {
                const currentUser = optionList.splice(idx, 1);
                optionList.unshift(currentUser[0]);
            }
        }

        setUserNotInChannelOptions(optionNotInTeamList);
        setUserOptions(optionList);
    }

    // Fill in the userOptions on mount.
    useEffect(() => {
        fetchUsers();
    }, []);

    const [selected, setSelected] = useState<Option | null>(null);

    // Whenever the selectedUserId changes we have to set the selected, but we can only do this once we
    // have userOptions
    useEffect(() => {
        if (userOptions === []) {
            return;
        }
        const user = userOptions.find((option: Option) => option.user.id === props.selectedUserId);
        if (user) {
            setSelected(user);
        } else {
            setSelected(null);
        }
    }, [userOptions, props.selectedUserId]);

    const onSelectedChange = async (value: Option | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }
        toggleOpen();
        if (value?.user.id === selected?.user.id) {
            return;
        }
        if (props.onSelectedChange) {
            props.onSelectedChange(value?.userType, value?.user);
        }
    };

    const dropdownArrow = props.customDropdownArrow ? props.customDropdownArrow : (
        <i className={'icon-chevron-down icon--small ml-2'}/>
    );

    let target;
    if (props.selectedUserId) {
        target = (
            <ProfileButton
                enableEdit={props.enableEdit}
                userId={props.selectedUserId}
                withoutProfilePic={props.withoutProfilePic}
                withoutName={props.selectWithoutName}
                profileButtonClass={props.profileButtonClass}
                onClick={props.enableEdit ? toggleOpen : () => null}
                customDropdownArrow={props.customDropdownArrow}
            />
        );
    } else if (props.placeholderButtonClass) {
        target = (
            <button
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
                className={props.placeholderButtonClass}
            >
                {props.placeholder}
                {dropdownArrow}
            </button>
        );
    } else {
        target = (
            <PlaybookRunFilterButton
                active={isOpen}
                onClick={() => {
                    if (props.enableEdit) {
                        toggleOpen();
                    }
                }}
            >
                {selected === null ? props.placeholder : selected.label}
                {dropdownArrow}
            </PlaybookRunFilterButton>
        );
    }

    if (props.onlyPlaceholder) {
        target = (
            <div>
                {props.placeholder}
            </div>
        );
    }
    const targetWrapped = (
        <div
            data-testid={props.testId}
            onClick={props.enableEdit ? toggleOpen : props.onEditDisabledClick}
            className={props.className}
        >
            {target}
        </div>
    );

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {
        ...noDropdown,
        Control: props.customControl,
    } : noDropdown;

    const selectOptions = (userNotInChannelOptions.length === 0) ? userOptions : [{label: formatMessage({defaultMessage: 'CHANNEL MEMBERS'}), options: userOptions},
        {label: formatMessage({defaultMessage: 'NOT IN CHANNEL'}), options: userNotInChannelOptions}];

    return (
        <Dropdown
            target={targetWrapped}
            placement={props.placement}
            isOpen={isOpen}
            onOpenChange={setOpen}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={selectOptions}
                placeholder={formatMessage({defaultMessage: 'Search'})}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option, action) => onSelectedChange(option as Option, action as ActionObj)}
                classNamePrefix='playbook-run-user-select'
                className='playbook-run-user-select'
                {...props.customControlProps}
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles: StylesConfig<Option, boolean> = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

const getFullName = (firstName: string, lastName: string): string => {
    return (firstName + ' ' + lastName).trim();
};

const getUserDescription = (firstName: string, lastName: string, nickName: string): string => {
    if ((firstName || lastName) && nickName) {
        return ` ${getFullName(firstName, lastName)} (${nickName})`;
    } else if (nickName) {
        return ` (${nickName})`;
    } else if (firstName || lastName) {
        return ` ${getFullName(firstName, lastName)}`;
    }

    return '';
};

export const formatProfileName = (descriptionSuffix: string) => {
    return (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => {
        const name = '@' + userName;
        const description = getUserDescription(firstName, lastName, nickName) + descriptionSuffix;
        return (
            <>
                <span>{name}</span>
                {description && <Description className={'description'}>{description}</Description>}
            </>
        );
    };
};

const Description = styled.span`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;
