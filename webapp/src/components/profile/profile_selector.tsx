// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import ReactSelect, {ActionTypes, ControlProps, StylesConfig} from 'react-select';
import classNames from 'classnames';
import styled, {css} from 'styled-components';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';

import './profile_selector.scss';
import Profile from 'src/components/profile/profile';
import ProfileButton from 'src/components/profile/profile_button';
import {useClientRect} from 'src/hooks';
import {PlaybookRunFilterButton} from '../backstage/styles';

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
    showOnRight?: boolean;
    className?: string;
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
    const [userNotInChannelOptions, setUserNotInChannelOptions] = useState<Option[]>([]);

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

        const [users, usersInTeam] = await Promise.all([props.getUsers(), props.getUsersInTeam()]);
        const usersNotInChannel = usersInTeam.filter((user) => !users.includes(user));

        const optionNotInTeamList = usersNotInChannel.map((user: UserProfile) => {
            return ({
                value: nameAsText(user.username, user.first_name, user.last_name, user.nickname),
                label: (
                    <Profile
                        userId={user.id}
                        nameFormatter={needsSuffix(user.id) ? formatName(' (assign to me)') : formatName('')}
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
                        nameFormatter={needsSuffix(user.id) ? formatName(' (assign to me)') : formatName('')}
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

    // Decide where to open the profile selector
    const [rect, ref] = useClientRect();
    const [moveUp, setMoveUp] = useState(0);

    useEffect(() => {
        if (!rect) {
            setMoveUp(0);
            return;
        }

        const innerHeight = window.innerHeight;
        const numProfilesShown = Math.min(6, userOptions.length);
        const spacePerProfile = 48;
        const dropdownYShift = 27;
        const dropdownReqSpace = 80;
        const extraSpace = 10;
        const dropdownBottom = rect.top + dropdownYShift + dropdownReqSpace + (numProfilesShown * spacePerProfile) + extraSpace;
        setMoveUp(Math.max(0, dropdownBottom - innerHeight));
    }, [rect, userOptions.length]);

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
                {<i className='icon-chevron-down icon--small ml-2'/>}
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
                {<i className='icon-chevron-down icon--small ml-2'/>}
            </PlaybookRunFilterButton>
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
    const targetWrapped = (
        <div
            data-testid={props.testId}
            ref={ref}
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

    return (
        <Dropdown
            isOpen={isOpen}
            onClose={toggleOpen}
            target={targetWrapped}
            showOnRight={props.showOnRight}
            moveUp={moveUp}
        >
            <ReactSelect
                autoFocus={true}
                backspaceRemovesValue={false}
                components={components}
                controlShouldRenderValue={false}
                hideSelectedOptions={false}
                isClearable={props.isClearable}
                menuIsOpen={true}
                options={[{label: formatMessage({defaultMessage: 'CHANNEL MEMBERS'}), options: userOptions},
                    {label: formatMessage({defaultMessage: 'NOT IN CHANNEL'}), options: userNotInChannelOptions}]}
                placeholder={'Search'}
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

// styled components
interface DropdownProps {
    children: JSX.Element;
    isOpen: boolean;
    showOnRight?: boolean;
    moveUp?: number;
    target: JSX.Element;
    onClose: () => void;
}

const ProfileDropdown = styled.div`
    position: relative;
`;

const Blanket = styled.div`
    bottom: 0;
    left: 0;
    top: 0;
    right: 0;
    position: fixed;
    z-index: 1;
`;

interface ChildContainerProps {
    moveUp?: number;
    showOnRight?: boolean;
}

const ChildContainer = styled.div<ChildContainerProps>`
    margin: 4px 0 0;
    min-width: 20rem;
    top: ${(props) => 27 - (props.moveUp || 0)}px;
    ${(props) => props.showOnRight && css`
        right: -55px;
    `}
`;

const Dropdown = ({children, isOpen, showOnRight, moveUp, target, onClose}: DropdownProps) => {
    if (!isOpen) {
        return target;
    }

    const classes = classNames('PlaybookRunFilter', 'profile-dropdown',
        'PlaybookRunFilter--active', 'profile-dropdown--active');

    return (
        <ProfileDropdown className={classes}>
            {target}
            <ChildContainer
                className='playbook-run-user-select__container'
                moveUp={moveUp}
                showOnRight={showOnRight}
            >
                {children}
            </ChildContainer>
            <Blanket onClick={onClose}/>
        </ProfileDropdown>
    );
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
