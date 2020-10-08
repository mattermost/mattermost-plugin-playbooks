// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingIncident, setRHSViewingList} from 'src/actions';
import RHSListView from 'src/components/rhs/rhs_list_view';
import {currentRHSState, isIncidentChannel} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import RHSDetailsView from 'src/components/rhs/rhs_details_view';

const RightHandSidebar: FC<null> = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const inIncidentChannel = useSelector<GlobalState, boolean>((state) => isIncidentChannel(state, currentChannelId));
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

        if (inIncidentChannel) {
            dispatch(setRHSViewingIncident());
        } else {
            dispatch(setRHSViewingList());
        }
    }

    if (rhsState === RHSState.ViewingIncident) {
        if (inIncidentChannel) {
            return <RHSDetailsView/>;
        }
        return <RHSWelcomeView/>;
    }

    return <RHSListView/>;
};

export default RightHandSidebar;
