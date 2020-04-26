// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import ReactSelect from 'react-select';

import {css} from '@emotion/core';

import {UserProfile} from 'mattermost-redux/types/users';

import {fetchUsersInChannel, setCommander} from 'src/client';

import './profile_selector.scss';
import Profile from 'src/components/profile';
import ProfileButton from 'src/components/profile/profile_selector/profile_button/profile_button';
import {getUserDescription} from 'src/utils/utils';

interface Props {
    commanderId: string;
    channelId?: string;
    incidentId: string;
    enableEdit: boolean;
}

interface Option {
    value: string;
    label: JSX.Element;
    userId: string;
}

export default function ProfileSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [userOptions, setUserOptions] = useState<Option[]>([]);

    // Fill in the userOptions, but only once on mount. This means we won't update when channel
    // membership changes.
    // TODO: Is there any way to get the user list from the store? https://mattermost.atlassian.net/browse/MM-24329
    useEffect(() => {
        async function fetchUsers() {
            if (!props.channelId) {
                return;
            }

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

            const users = await fetchUsersInChannel(props.channelId);
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
        }
    }, [userOptions, props.commanderId]);

    const onSelectedChange = async (value: Option) => {
        toggleOpen();
        if (value.userId === selected?.userId) {
            return;
        }
        const response = await setCommander(props.incidentId, value.userId);
        if (response.error) {
            // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
            console.log(response.error); // eslint-disable-line no-console
        }
    };

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={
                <ProfileButton
                    enableEdit={props.enableEdit}
                    userId={props.commanderId}
                    onClick={props.enableEdit ? toggleOpen : () => null}
                />
            }
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={false}
                menuIsOpen={true}
                options={userOptions}
                placeholder={'Search'}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option) => onSelectedChange(option as Option)}
                classNamePrefix='react-select-auto react-select'
                className='react-select'
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
        className={`profile-dropdown${isOpen ? ' profile-dropdown--active' : ''}`}
        css={{position: 'relative'}}
    >
        {target}
        {isOpen ? <Menu className='react-select__container'>{children}</Menu> : null}
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

