// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from 'mattermost-redux/types/store';
import React, {FC, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {setRHSOpen} from 'src/actions';
import RHSListView from 'src/components/rhs/rhs_incident_list';
import RHSIncidentView from 'src/components/rhs/rhs_incident_view';

import {currentRHSState} from 'src/selectors';
import {RHSState} from 'src/types/rhs';

const RightHandSidebar: FC<null> = () => {
    const dispatch = useDispatch();
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    if (rhsState === RHSState.ViewingList) {
        return <RHSListView/>;
    }
    return <RHSIncidentView/>;
};

export default RightHandSidebar;
