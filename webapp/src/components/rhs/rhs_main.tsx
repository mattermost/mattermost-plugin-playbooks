// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {receivedTeamPlaybookRuns, setRHSOpen, setRHSViewingPlaybookRun, setRHSViewingList} from 'src/actions';
import RHSHome from 'src/components/rhs/rhs_home';
import {currentRHSState, inPlaybookRunChannel} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';

import {fetchPlaybookRunByChannel} from 'src/client';
import {ToastProvider} from '../backstage/toast_banner';

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const inPlaybookRun = useSelector<GlobalState, boolean>(inPlaybookRunChannel);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [seenChannelId, setSeenChannelId] = useState('');

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    useEffect(() => {
        const checkPlaybookRun = async () => {
            // By default, we only have the in-progress runs in the store, so when the inPlaybookRunChannel
            // selector returned false, we still need to check if we are in a finished run
            if (!inPlaybookRun) {
                try {
                    const playbookRun = await fetchPlaybookRunByChannel(currentChannelId);
                    dispatch(receivedTeamPlaybookRuns([playbookRun]));
                    dispatch(setRHSViewingPlaybookRun());
                } catch (error) {
                    if (error.status_code !== 404) {
                        throw error;
                    }
                }
            }
        };

        checkPlaybookRun();
    }, [currentChannelId]);

    // Update the rhs state when the channel changes
    if (currentChannelId !== seenChannelId) {
        setSeenChannelId(currentChannelId);

        if (inPlaybookRun) {
            dispatch(setRHSViewingPlaybookRun());
        } else {
            dispatch(setRHSViewingList());
        }
    }

    let content = null;
    if (rhsState === RHSState.ViewingPlaybookRun) {
        if (inPlaybookRun) {
            content = <RHSRunDetails/>;
        } else {
            content = <RHSWelcomeView/>;
        }
    } else {
        content = <RHSHome/>;
    }

    return (
        <ToastProvider>
            {content}
        </ToastProvider>
    );
};

export default RightHandSidebar;

