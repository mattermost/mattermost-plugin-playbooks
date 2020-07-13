import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';

import debounce from 'lodash/debounce';
import AsyncSelect from 'react-select/async';
import {useSelector, useDispatch} from 'react-redux';
import {getProfilesByIds} from 'mattermost-redux/actions/users';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

// ProfileAutocomplete searches and selects user profiles displayed by username.
// Users prop receives an array of user ids and
// returns the selected users ids in the `OnChange` value parameter.
const ProfileAutocomplete = (props) => {
    const dispatch = useDispatch();

    const currentUser = useSelector(getCurrentUser);
    const [userProfiles, setUserProfiles] = useState([]);

    useEffect(() => {
        fetchUserProfiles();
    }, []);

    const fetchUserProfiles = async () => {
        if (!props.userIds || !props.userIds.length) {
            return;
        }
        const result = await dispatch(getProfilesByIds(props.userIds));
        let profiles = result.data;

        if (profiles.length !== props.userIds.length) {
            // Check if all ids were returned.
            // mattermost-redux removes the current admin user from the result at:
            // https://github.com/mattermost/mattermost-redux/blob/5f5a8a5007661f6d54533c2b51299748338b5a65/src/actions/users.ts#L340
            const unknownIds = props.userIds.filter((userId) =>
                !profiles.find((user) => user.id === userId),
            );

            // Add the current user if it was removed by redux.
            const currentUserIdx = unknownIds.indexOf(currentUser.id);
            if (currentUserIdx > -1) {
                unknownIds.splice(currentUserIdx, 1);
                profiles.push(currentUser);
            }

            // Any other unkwnown, just add the id direclty.
            if (unknownIds.length > 0) {
                profiles = profiles.concat(unknownIds);
            }
        }
        setUserProfiles(profiles);
    };
    const onChange = (value = []) => {
        const userIds = value?.map((profile) => {
            return profile.id;
        }) || [];
        if (props.onChange) {
            props.onChange(userIds);
        }
        setUserProfiles(value);
    };

    const getOptionValue = (user) => {
        if (user.id) {
            return user.id;
        }

        return user;
    };

    const formatOptionLabel = (option) => {
        if (option.username) {
            return (
                <React.Fragment>
                    { `@${option.username}`}
                </React.Fragment>
            );
        }

        return option;
    };

    const debouncedSearchProfiles = debounce((term, callback) => {
        props.searchProfiles(term).then(({data}) => {
            callback(data);
        }).catch(() => {
            // eslint-disable-next-line no-console
            console.error('Error searching user profiles in custom attribute settings dropdown.');
            callback([]);
        });
    }, 150);

    const usersLoader = (term, callback) => {
        try {
            debouncedSearchProfiles(term, callback);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            callback([]);
        }
    };

    return (
        <AsyncSelect
            isMulti={true}
            cacheOptions={true}
            defaultOptions={false}
            loadOptions={usersLoader}
            onChange={onChange}
            getOptionValue={getOptionValue}
            formatOptionLabel={formatOptionLabel}
            defaultMenuIsOpen={false}
            openMenuOnClick={false}
            isClearable={false}
            placeholder={props.placeholder}
            value={userProfiles}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null}}
            styles={customStyles}
        />
    );
};

ProfileAutocomplete.propTypes = {
    placeholder: PropTypes.string,
    userIds: PropTypes.array,
    onChange: PropTypes.func,
    searchProfiles: PropTypes.func.isRequired,
};

export default ProfileAutocomplete;

const customStyles = {
    control: (provided) => ({
        ...provided,
        minHeight: 34,
    }),
};
