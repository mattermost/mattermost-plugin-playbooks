// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {debounce} from 'debounce';
import {useIntl} from 'react-intl';
import {UserProfile} from 'mattermost-webapp/packages/types/src/users';
import {OptionsType, OptionTypeBase, StylesConfig} from 'react-select';
import {ActionFunc} from 'mattermost-webapp/packages/mattermost-redux/src/types/actions';

import {StyledAsyncSelect} from '../../profile_autocomplete';
import Profile, {ProfileImage, ProfileName} from 'src/components/profile/profile';
interface Props {
    searchProfiles: (term: string) => ActionFunc;
    setValues: (values: UserProfile[]) => void;
}

const ParticipantsSelector = (props: Props) => {
    const {formatMessage} = useIntl();

    const onChange = (value: UserProfile[]) => {
        props.setValues([...value]);
    };

    const getOptionValue = (user: UserProfile) => {
        return user.id;
    };

    const formatOptionLabel = (option: UserProfile, context: {context: string}) => {
        // different view for selected values
        if (context.context === 'value') {
            return (
                <React.Fragment>
                    <StyledProfile userId={option.id}/>
                </React.Fragment>
            );
        }
        return (
            <React.Fragment>
                <Profile userId={option.id}/>
            </React.Fragment>
        );
    };

    const debouncedSearchProfiles = debounce((term: string, callback: (options: OptionsType<UserProfile>) => void) => {
        if (term.trim().length === 0) {
            return;
        }
        const profiles = props.searchProfiles(term);

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

    const noDropdown = {DropdownIndicator: null, IndicatorSeparator: null};

    return (
        <StyledAsyncSelect
            autoFocus={true}
            components={noDropdown}

            isClearable={false}
            loadOptions={usersLoader}
            isMulti={true}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}

            styles={selectStyles}
            placeholder={formatMessage({defaultMessage: 'Search for people'})}
        />
    );
};

const StyledProfile = styled(Profile)`
    height: 24px;

    ${ProfileImage} {
        width: 24px;
        height: 24px;
    }

    ${ProfileName} {
        font-weight: 600;
        font-size: 14px;
        line-height: 16px;
    }
    
`;

// styles for the select component
const selectStyles: StylesConfig<OptionTypeBase, boolean> = {
    control: (provided, {isDisabled}) => ({
        ...provided,
        backgroundColor: isDisabled ? 'rgba(var(--center-channel-bg-rgb),0.16)' : 'var(--center-channel-bg)',
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        height: '48px',
        fontSize: '16px',
    }),
    placeholder: (provided) => ({
        ...provided,
        marginLeft: '8px',
    }),
    input: (provided) => ({
        ...provided,
        marginLeft: '8px',
        color: 'var(--center-channel-color)',
    }),
    multiValue: (provided) => ({
        ...provided,
        backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.08)',
        borderRadius: '16px',
        paddingLeft: '8px',
        overflow: 'hidden',
        height: '32px',
        alignItems: 'center',
    }),
    multiValueLabel: (provided) => ({
        ...provided,
        padding: 0,
        paddingLeft: 0,
        lineHeight: '18px',
        color: 'var(--center-channel-color)',
    }),
    multiValueRemove: (provided) => ({
        ...provided,
        color: 'rgba(var(--center-channel-bg-rgb), 0.80)',
        backgroundColor: 'rgba(var(--center-channel-color-rgb),0.32)',
        borderRadius: '50%',
        margin: '4px',
        padding: 0,
        cursor: 'pointer',
        width: '16px',
        height: '16px',
        ':hover': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        ':active': {
            backgroundColor: 'rgba(var(--center-channel-color-rgb),0.56)',
        },
        '> svg': {
            height: '16px',
            width: '16px',
        },
    }),
};

export default ParticipantsSelector;
