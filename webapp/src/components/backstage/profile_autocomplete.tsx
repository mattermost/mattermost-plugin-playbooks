import React from 'react';
import {useIntl} from 'react-intl';

import {debounce} from 'debounce';
import AsyncSelect from 'react-select/async';

import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {OptionsType, ControlProps} from 'react-select';

import Profile from 'src/components/profile/profile';

export const StyledAsyncSelect = styled(AsyncSelect)`
    flex-grow: 1;
    background-color: var(--center-channel-bg);

    .profile-autocomplete__menu-list {
        background-color: var(--center-channel-bg);
        border: none;
    }

    .profile-autocomplete__input {
        color: var(--center-channel-color);
    }

    .profile-autocomplete__option--is-selected {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .profile-autocomplete__option--is-focused {
        background-color: rgba(var(--center-channel-color-rgb), 0.16);
    }

    .profile-autocomplete__control {
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: rgba(var(--center-channel-color-rgb), 0.56);
            content: '\f0349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }

    .profile-autocomplete__option {
        &:active {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
`;

interface Props {
    userIds: string[];
    onAddUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    isDisabled?: boolean;
}

const ProfileAutocomplete = (props: Props) => {
    const {formatMessage} = useIntl();

    const onChange = (userAdded: UserProfile) => {
        props.onAddUser(userAdded.id);
    };

    const getOptionValue = (user: UserProfile) => {
        return user.id;
    };

    const formatOptionLabel = (option: UserProfile) => {
        return (
            <React.Fragment>
                <Profile userId={option.id}/>
            </React.Fragment>
        );
    };

    const debouncedSearchProfiles = debounce((term: string, callback: (options: OptionsType<UserProfile>) => void) => {
        let profiles;
        if (term.trim().length === 0) {
            profiles = props.getProfiles();
        } else {
            profiles = props.searchProfiles(term);
        }

        //@ts-ignore
        profiles.then(({data}) => {
            callback(data);
        }).catch(() => {
            // eslint-disable-next-line no-console
            console.error('Error searching user profiles in custom attribute settings dropdown.');
            callback([]);
        });
    }, 150);

    const usersLoader = (term: string, callback: (options: OptionsType<UserProfile>) => void) => {
        try {
            debouncedSearchProfiles(term, callback);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    };

    return (
        <StyledAsyncSelect
            autoFocus={true}
            isDisabled={props.isDisabled}
            isMulti={false}
            controlShouldRenderValue={false}
            cacheOptions={false}
            defaultOptions={true}
            loadOptions={usersLoader}
            filterOption={({data}: { data: UserProfile }) => !props.userIds.includes(data.id)}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            value={null}
            placeholder={formatMessage({defaultMessage: 'Add People'})}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null}}
            styles={customStyles}
            classNamePrefix='profile-autocomplete'
        />
    );
};

export default ProfileAutocomplete;

const customStyles = {
    control: (provided: ControlProps<UserProfile, boolean>) => ({
        ...provided,
        minHeight: 34,
    }),
};
