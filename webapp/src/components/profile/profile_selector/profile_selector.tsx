// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import ReactSelect, {ActionTypes, ControlProps} from 'react-select';
import {css} from '@emotion/core';

import {UserProfile} from 'mattermost-redux/types/users';

import './profile_selector.scss';
import Profile from 'src/components/profile';
import ProfileButton from 'src/components/profile/profile_selector/profile_button/profile_button';

interface Props {
    commanderId?: string;
    enableEdit: boolean;
    isClearable?: boolean;
    customControl?: (props: ControlProps<any>) => React.ReactElement;
    controlledOpenToggle?: boolean;
    getUsers: () => Promise<UserProfile[]>;
    onSelectedChange: (userId?: string) => void;
}

interface Option {
    value: string;
    label: JSX.Element;
    userId: string;
}

interface ActionObj {
    action: ActionTypes;
}

export const getFullName = (firstName: string, lastName: string): string => {
    if (firstName && lastName) {
        return firstName + ' ' + lastName;
    } else if (firstName) {
        return firstName;
    } else if (lastName) {
        return lastName;
    }

    return '';
};

export const getUserDescription = (firstName: string, lastName: string, nickName: string): string => {
    if ((firstName || lastName) && nickName) {
        return ` ${getFullName(firstName, lastName)} (${nickName})`;
    } else if (nickName) {
        return ` (${nickName})`;
    } else if (firstName || lastName) {
        return ` ${getFullName(firstName, lastName)}`;
    }

    return '';
};

export default function ProfileSelector(props: Props) {
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
        const formatName = (preferredName: string, userName: string, firstName: string, lastName: string, nickName: string) => {
            const name = '@' + userName;
            const description = getUserDescription(firstName, lastName, nickName);
            return (
                <>
                    <span>{name}</span>
                    {description && <span className={'description'}>{description}</span>}
                </>
            );
        };

        const nameAsText = (userName: string, firstName: string, lastName: string, nickName: string): string => {
            return '@' + userName + getUserDescription(firstName, lastName, nickName);
        };

        const users = await props.getUsers();
        const optionList = users.map((user: UserProfile) => {
            return ({
                value: nameAsText(user.username, user.first_name, user.last_name, user.nickname),
                label: (
                    <Profile
                        userId={user.id}
                        nameFormatter={formatName}
                    />
                ),
                userId: user.id,
            });
        });
        setUserOptions(optionList);
    }

    // Fill in the userOptions on mount.
    useEffect(() => {
        fetchUsers();
    }, []);

    const [selected, setSelected] = useState<Option | null>(null);

    // Whenever the commanderId changes we have to set the selected, but we can only do this once we
    // have userOptions
    useEffect(() => {
        if (userOptions === []) {
            return;
        }

        const commander = userOptions.find((option: Option) => option.userId === props.commanderId);
        if (commander) {
            setSelected(commander);
        } else {
            setSelected(null);
        }
    }, [userOptions, props.commanderId]);

    const onSelectedChange = async (value: Option | undefined, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }
        toggleOpen();
        if (value?.userId === selected?.userId) {
            return;
        }
        props.onSelectedChange(value?.userId);
    };

    let target;
    if (props.commanderId) {
        target = (
            <ProfileButton
                enableEdit={props.enableEdit}
                userId={props.commanderId}
                onClick={props.enableEdit ? toggleOpen : () => null}
            />
        );
    } else {
        target = (
            <button
                onClick={toggleOpen}
                className={'IncidentFilter-button'}
            >
                {'Commander'}
                {<i className='icon-chevron-down icon--small ml-2'/>}
            </button>
        );
    }

    // The following is awkward, but makes TS happy.
    const baseComponents = {DropdownIndicator: null, IndicatorSeparator: null};
    const components = props.customControl ? {...baseComponents, Control: props.customControl} : baseComponents;

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={target}
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
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles = {
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
    target: JSX.Element;
    onClose: () => void;
}

const Dropdown = ({children, isOpen, target, onClose}: DropdownProps) => (
    <div
        className={`IncidentFilter profile-dropdown${isOpen ? ' IncidentFilter--active profile-dropdown--active' : ''}`}
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

