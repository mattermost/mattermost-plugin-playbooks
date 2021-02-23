// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import {css} from '@emotion/core';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';

import './profile_selector.scss';
import Profile from 'src/components/profile/profile';
import ProfileButton from 'src/components/profile/profile_button';

interface Option {
    value: string;
    label: JSX.Element|string;
    userId: string;
}

interface ActionObj {
    action: ActionTypes;
}

interface Props {
    selectedUserId?: string;
    placeholder: React.ReactNode;
    placeholderButtonClass?: string;
    profileButtonClass?: string;
    onlyPlaceholder?: boolean;
    enableEdit: boolean;
    isClearable?: boolean;
    customControl?: (props: ControlProps<any>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    withoutProfilePic?: boolean;
    defaultValue?: string;
    selfIsFirstOption?: boolean;
    getUsers: () => Promise<UserProfile[]>;
    onSelectedChange?: (userId?: string) => void;
    customControlProps?: any;
    showOnRight?: boolean;
}

export default function ProfileSelector(props: Props) {
    const currentUserId = useSelector<GlobalState, string>(getCurrentUserId);

    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        if (!isOpen) {
            fetchUsers();
        }
        setOpen(!isOpen);
    };

    // Allow the parent component to control the open state -- only after mounting.
    const [oldOpenToggle, setOldOpenToggle] = useState(props.controlledOpenToggle);
    useEffect(() => {
        // eslint-disable-next-line no-undefined
        if (props.controlledOpenToggle !== undefined && props.controlledOpenToggle !== oldOpenToggle) {
            setOpen(!isOpen);
            setOldOpenToggle(props.controlledOpenToggle);
        }
    }, [props.controlledOpenToggle]);

    const [userOptions, setUserOptions] = useState<Option[]>([]);

    async function fetchUsers() {
        const formatName = (descriptionSuffix: string) => {
            return (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => {
                const name = '@' + userName;
                const description = getUserDescription(firstName, lastName, nickName) + descriptionSuffix;
                return (
                    <>
                        <span>{name}</span>
                        {description && <span className={'description'}>{description}</span>}
                    </>
                );
            };
        };

        const nameAsText = (userName: string, firstName: string, lastName: string, nickName: string): string => {
            return '@' + userName + getUserDescription(firstName, lastName, nickName);
        };

        const needsSuffix = (userId: string) => {
            return props.selfIsFirstOption && userId === currentUserId;
        };

        const users = await props.getUsers();
        const optionList = users.map((user: UserProfile) => {
            return ({
                value: nameAsText(user.username, user.first_name, user.last_name, user.nickname),
                label: (
                    <Profile
                        userId={user.id}
                        nameFormatter={needsSuffix(user.id) ? formatName(' (assign to me)') : formatName('')}
                    />
                ),
                userId: user.id,
            } as Option);
        });

        if (props.selfIsFirstOption) {
            const idx = optionList.findIndex((elem) => elem.userId === currentUserId);
            if (idx > 0) {
                const currentUser = optionList.splice(idx, 1);
                optionList.unshift(currentUser[0]);
            }
        }

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

        const user = userOptions.find((option: Option) => option.userId === props.selectedUserId);
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
        if (value?.userId === selected?.userId) {
            return;
        }
        if (props.onSelectedChange) {
            props.onSelectedChange(value?.userId);
        }
    };

    let target;
    if (props.selectedUserId) {
        target = (
            <ProfileButton
                enableEdit={props.enableEdit}
                userId={props.selectedUserId}
                withoutProfilePic={props.withoutProfilePic}
                profileButtonClass={props.profileButtonClass}
                onClick={props.enableEdit ? toggleOpen : () => null}
            />
        );
    } else {
        target = (
            <button
                onClick={toggleOpen}
                className={props.placeholderButtonClass || 'IncidentFilter-button'}
            >
                {props.placeholder}
                {<i className='icon-chevron-down icon--small ml-2'/>}
            </button>
        );
    }

    if (props.onlyPlaceholder) {
        target = (
            <div
                onClick={toggleOpen}
            >
                {props.placeholder}
            </div>
        );
    }

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {...noDropdown, Control: props.customControl} : noDropdown;

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={target}
            showOnRight={props.showOnRight}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={userOptions}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option, action) => onSelectedChange(option as Option, action as ActionObj)}
                classNamePrefix='incident-user-select'
                className='incident-user-select'
                {...props.customControlProps}
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles: StylesConfig = {
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

// styled components
interface DropdownProps {
    children: JSX.Element;
    isOpen: boolean;
    showOnRight?: boolean;
    target: JSX.Element;
    onClose: () => void;
}

const Dropdown = ({children, isOpen, showOnRight, target, onClose}: DropdownProps) => (
    <div
        className={`IncidentFilter profile-dropdown${isOpen ? ' IncidentFilter--active profile-dropdown--active' : ''} ${showOnRight && 'show-on-right'}`}
        css={{position: 'relative'}}
    >
        {target}
        {isOpen ? <Menu className='IncidentFilter-select incident-user-select__container'>
            {children}
        </Menu> : null}
        {isOpen ? <Blanket onClick={onClose}/> : null}
    </div>
);

const Menu = (props: Record<string, any>) => {
    return (
        <div {...props}/>
    );
};

const Blanket = (props: Record<string, any>) => (
    <div
        css={{
            bottom: 0,
            left: 0,
            top: 0,
            right: 0,
            position: 'fixed',
            zIndex: 1,
        }}
        {...props}
    />
);

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
