// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {toggle} from 'mattermost-webapp/actions/views/lhs';
import React, {useEffect, useState} from 'react';

import Select, {defaultTheme} from 'react-select';

import {Client4} from 'mattermost-redux/client';
import {UserProfile} from 'mattermost-redux/types/users';
import {fetchUsersInChannel, setCommander} from 'src/client';

import Profile from 'src/components/rhs/profile';
import ProfileButton from 'src/components/rhs/profile_selector/profile_button/profile_button';

type Props = {
    commanderId: string;
    channelId: string;
    incidentId: string;
}

type Option = {
    value: UserProfile;
    label: JSX.Element;
}

const {colors} = defaultTheme;
const selectStyles = {
    control: (provided) => ({...provided, minWidth: 240, margin: 8}),
    menu: () => ({boxShadow: 'inset 0 1px 0 rgba(0, 0, 0, 0.1)'}),
};

export default function ProfileSelector(props: Props) {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const [selected, setSelected] = useState<Option | null>(null);
    const onSelectedChange = (value: Option) => {
        toggleOpen();
        if (value.value.id === selected?.value.id) {
            return;
        }

        setCommander(props.incidentId, value.value.id);

        // TODO: For now assume it worked.
        setSelected(value);
    };

    const [options, setOptions] = useState<Option[]>([]);
    useEffect(() => {
        async function fetchUsers() {
            const users = await fetchUsersInChannel(props.channelId);
            const optionList = users.map((user) => {
                return ({
                    value: user,
                    label: <Profile userId={user.id}/>,
                });
            });
            const commander = optionList.find((option: Option) => option.value.id === props.commanderId);
            if (commander) {
                setSelected(commander);
            }
            setOptions(optionList);
        }

        fetchUsers();
    }, []);

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={
                <ProfileButton
                    user={selected?.value}
                    onClick={toggleOpen}
                />
            }
        >
            <Select
                autoFocus={true}
                backspaceRemovesValue={false}
                components={{DropdownIndicator, IndicatorSeparator: null}}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={false}
                menuIsOpen={true}
                options={options}
                placeholder={'Search...'}
                styles={selectStyles}
                tabSelectsValue={false}
                value={selected}
                onChange={(option) => onSelectedChange(option as Option)}
            />
        </Dropdown>
    );
}

// styled components

const Menu = props => {
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
const Blanket = props => (
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
const Dropdown = ({children, isOpen, target, onClose}) => (
    <div css={{position: 'relative'}}>
        {target}
        {isOpen ? <Menu>{children}</Menu> : null}
        {isOpen ? <Blanket onClick={onClose}/> : null}
    </div>
);
const Svg = p => (
    <svg
        width='24'
        height='24'
        viewBox='0 0 24 24'
        focusable='false'
        role='presentation'
        {...p}
    />
);
const DropdownIndicator = () => (
    <div css={{color: colors.neutral20, height: 24, width: 32}}>
        <Svg>
            <path
                d='M16.436 15.085l3.94 4.01a1 1 0 0 1-1.425 1.402l-3.938-4.006a7.5 7.5 0 1 1 1.423-1.406zM10.5 16a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z'
                fill='currentColor'
                fillRule='evenodd'
            />
        </Svg>
    </div>
);
const ChevronDown = () => (
    <Svg style={{marginRight: -6}}>
        <path
            d='M8.292 10.293a1.009 1.009 0 0 0 0 1.419l2.939 2.965c.218.215.5.322.779.322s.556-.107.769-.322l2.93-2.955a1.01 1.01 0 0 0 0-1.419.987.987 0 0 0-1.406 0l-2.298 2.317-2.307-2.327a.99.99 0 0 0-1.406 0z'
            fill='currentColor'
            fillRule='evenodd'
        />
    </Svg>
);
