// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {getGroups} from 'mattermost-redux/actions/groups';
import {getAllGroups} from 'mattermost-redux/selectors/entities/groups';

/**
 * Returns the list of groups with allow_reference=true,
 * dispatching a fetch if the Redux store has no groups yet.
 */
export const useAllowReferenceGroups = () => {
    const dispatch = useDispatch();
    const allGroupsMap = useSelector(getAllGroups);
    const groups = useMemo(
        () => Object.values(allGroupsMap).filter((g) => g.allow_reference),
        [allGroupsMap],
    );

    useEffect(() => {
        if (Object.keys(allGroupsMap).length === 0) {
            dispatch(getGroups({filter_allow_reference: true, per_page: 100, page: 0}));
        }
    }, [dispatch, allGroupsMap]);

    return groups;
};
