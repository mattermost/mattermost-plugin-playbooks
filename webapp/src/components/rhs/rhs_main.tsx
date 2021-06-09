// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingIncident, setRHSViewingList} from 'src/actions';
import RHSListView from 'src/components/rhs/rhs_list_view';
import {currentRHSState, inIncidentChannel} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import RHSDetailsView from 'src/components/rhs/rhs_details_view';

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const inIncident = useSelector<GlobalState, boolean>(inIncidentChannel);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [seenChannelId, setSeenChannelId] = useState('');

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    // Update the rhs state when the channel changes
    if (currentChannelId !== seenChannelId) {
        setSeenChannelId(currentChannelId);

        if (inIncident) {
            dispatch(setRHSViewingIncident());
        } else {
            dispatch(setRHSViewingList());
        }
    }

    if (rhsState === RHSState.ViewingIncident) {
        if (inIncident) {
            return <RHSDetailsView/>;
        }
        return <RHSWelcomeView/>;
    }

    return <RHSListView/>;
};

export default RightHandSidebar;

