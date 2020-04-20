// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import Select, {defaultTheme} from 'react-select';

import {css} from '@emotion/core';

import {UserProfile} from 'mattermost-redux/types/users';

import {fetchUsersInChannel, setCommander} from 'src/client';

import Profile from 'src/components/rhs/profile';
import ProfileButton from 'src/components/rhs/profile_selector/profile_button/profile_button';

interface Props {
    commanderId: string;
    channelId?: string;
    incidentId: string;
    enableEdit: boolean;
}

interface Option {
    value: UserProfile;
    label: JSX.Element;
}

export default function ProfileSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [userOptions, setUserOptions] = useState<Option[]>([]);

    // Fill in the userOptions, but only once on mount. This means we won't update when channel
    // membership changes.
    // TODO: get the user list from the store https://mattermost.atlassian.net/browse/MM-24329
    useEffect(() => {
        async function fetchUsers() {
            if (!props.channelId) {
                return;
            }

            const users = await fetchUsersInChannel(props.channelId);
            const optionList = users.map((user) => {
                return ({
                    value: user,
                    label: <Profile userId={user.id}/>,
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

        const commander = userOptions.find((option: Option) => option.value.id === props.commanderId);
        if (commander) {
            setSelected(commander);
        }
    }, [userOptions, props.commanderId]);

    const onSelectedChange = async (value: Option) => {
        toggleOpen();
        if (value.value.id === selected?.value.id) {
            return;
        }
        const response = await setCommander(props.incidentId, value.value.id);
        if (response.error) {
            // TODO: will be presented to the user after https://mattermost.atlassian.net/browse/MM-24271
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
                    user={selected?.value}
                    onClick={props.enableEdit ? toggleOpen : null}
                />
            }
        >
            <Select
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator: null, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={false}
                menuIsOpen={true}
                options={userOptions}
                placeholder={<div><i className={'fa fa-search mr-2'}/><span>{'Search...'}</span></div>}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option) => onSelectedChange(option as Option)}
            />
        </Dropdown>
    );
}

// styles for the select component
const selectStyles = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'inset 0 1px 0 rgba(0, 0, 0, 0.1)'}),
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
    <div css={{position: 'relative'}}>
        {target}
        {isOpen ? <Menu>{children}</Menu> : null}
        {isOpen ? <Blanket onClick={onClose}/> : null}
    </div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Menu = (props: Record<string, any>) => {
    const shadow = 'hsla(218, 50%, 10%, 0.1)';
    return (
        <div
            css={{
                backgroundColor: 'white',
                borderRadius: 4,
                boxShadow: `0 0 0 1px ${shadow}, 0 4px 11px ${shadow}`,
                marginTop: 8,
                position: 'absolute',
                zIndex: 2,
            }}
            {...props}
        />
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

