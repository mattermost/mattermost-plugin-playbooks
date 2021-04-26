import React, {FC, useState, useEffect} from 'react';
import {useSelector} from 'react-redux';

import ReactSelect, {ControlProps, MenuListComponentProps} from 'react-select';

import {Scrollbars} from 'react-custom-scrollbars';

import styled from 'styled-components';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {GlobalState} from 'mattermost-redux/types/store';
import {UserProfile} from 'mattermost-redux/types/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Profile from 'src/components/profile/profile';

interface Props {
    commanderID: string;
    onAddUser: (userid: string) => void;
    searchProfiles: (term: string) => ActionFunc;
    getProfiles: () => ActionFunc;
    isDisabled: boolean;
}

const AssignCommanderSelector: FC<Props> = (props: Props) => {
    const [options, setOptions] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const commanderUser = useSelector<GlobalState, UserProfile>((state: GlobalState) => getUser(state, props.commanderID));

    // Update the options whenever the commander ID or the search term are updated
    useEffect(() => {
        const updateOptions = async (term: string) => {
            let profiles;
            if (term.trim().length === 0) {
                profiles = props.getProfiles();
            } else {
                profiles = props.searchProfiles(term);
            }

            //@ts-ignore
            profiles.then(({data}: { data: UserProfile[] }) => {
                setOptions(data.filter((user: UserProfile) => user.id !== props.commanderID));
            }).catch(() => {
                // eslint-disable-next-line no-console
                console.error('Error searching user profiles in custom attribute settings dropdown.');
            });
        };

        updateOptions(searchTerm);
    }, [props.commanderID, searchTerm]);

    return (
        <StyledReactSelect
            closeMenuOnSelect={true}
            onInputChange={setSearchTerm}
            options={options}
            filterOption={() => true}
            isDisabled={props.isDisabled}
            isMulti={false}
            value={commanderUser}
            controlShouldRenderValue={!props.isDisabled}
            onChange={(userAdded: UserProfile) => props.onAddUser(userAdded.id)}
            getOptionValue={(user: UserProfile) => user.id}
            formatOptionLabel={(user: UserProfile) => (
                <StyledProfile userId={user.id}/>
            )}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={false}
            placeholder={'Search for member'}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null, MenuList}}
            styles={{
                control: (provided: ControlProps<UserProfile>) => ({
                    ...provided,
                    minHeight: 34,
                }),
            }}
            classNamePrefix='assign-commander-selector'
            captureMenuScroll={false}
        />
    );
};

export default AssignCommanderSelector;

const StyledProfile = styled(Profile)`
    color: var(--center-channel-color);

    && .image {
        width: 24px;
        height: 24px;
    }
`;

const StyledReactSelect = styled(ReactSelect)`
    flex-grow: 1;
    background-color: ${(props) => (props.isDisabled ? 'rgba(var(--center-channel-bg-rgb), 0.16)' : 'var(--center-channel-bg)')};

    .assign-commander-selector__input {
        color: var(--center-channel-color);
    }

    .assign-commander-selector__menu {
        background-color: transparent;
        box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    }


    .assign-commander-selector__option {
        height: 36px;
        padding: 6px 21px 6px 12px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .assign-commander-selector__option--is-selected {
        background-color: var(--center-channel-bg);
        color: var(--center-channel-color);
    }

    .assign-commander-selector__option--is-focused {
        background-color: rgba(var(--button-bg-rgb), 0.04);
    }

    .assign-commander-selector__control {
        -webkit-transition: all 0.15s ease;
        -webkit-transition-delay: 0s;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;
        transition-delay: 0s;
        background-color: transparent;
        border-radius: 4px;
        border: none;
        box-shadow: inset 0 0 0 1px var(--center-channel-color-16);
        width: 100%;
        height: 4rem;
        font-size: 14px;
        padding-left: 3.2rem;
        padding-right: 16px;

        &--is-focused {
            box-shadow: inset 0 0 0px 2px var(--button-bg);
        }

        &:before {
            left: 16px;
            top: 8px;
            position: absolute;
            color: var(--center-channel-color-56);
            content: '\f349';
            font-size: 18px;
            font-family: 'compass-icons', mattermosticons;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    }

    .assign-commander-selector__option {
        &:active {
            background-color: var(--center-channel-color-08);
        }
    }

    .assign-commander-selector__group-heading {
        height: 32px;
        padding: 8px 12px 8px;
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const MenuListWrapper = styled.div`
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;

    max-height: 280px;
`;

const MenuHeaderHeight = 44;

const MenuHeader = styled.div`
    height: ${MenuHeaderHeight}px;
    padding: 16px 0 12px 14px;
    font-size: 14px;
    font-weight: 600;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    line-height: 16px;
`;

const StyledScrollbars = styled(Scrollbars)`
    height: ${300 - MenuHeaderHeight}px;
`;

const ThumbVertical = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.24);
    border-radius: 2px;
    width: 4px;
    min-height: 45px;
    margin-left: -2px;
    margin-top: 6px;
`;

const MenuList = (props: MenuListComponentProps<UserProfile>) => {
    return (
        <MenuListWrapper>
            <MenuHeader>{'Assign Commander'}</MenuHeader>
            <StyledScrollbars
                autoHeight={true}
                renderThumbVertical={({style, ...thumbProps}) => <ThumbVertical {...thumbProps}/>}
            >
                {props.children}
            </StyledScrollbars>
        </MenuListWrapper>
    );
};
