// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingPlaybookRun} from 'src/actions';
import {currentRHSState} from 'src/selectors';
import {RHSState} from 'src/types/rhs';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';

import {ToastProvider} from '../backstage/toast_banner';

import {useRhsRunsQuery} from 'src/graphql/generated_types';

import RHSRunList from './rhs_run_list';
import RHSHome from './rhs_home';

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [currentRun, setCurrentRun] = useState<string|undefined>();
    const {data, error} = useRhsRunsQuery({
        variables: {
            channelID: currentChannelId,
        },
        fetchPolicy: 'cache-and-network',
    });

    // If there is only one run in this channel select it.
    useEffect(() => {
        if (data && data.runs.length === 1) {
            const singleRunID = data.runs[0].id;
            if (singleRunID !== currentRun) {
                setCurrentRun(singleRunID);
            }
        }
    }, [data]);

    // Let other parts of the app know if we are open or not
    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    if (error || !data) {
        return null;
    }

    // No runs (ever) in this channel
    if (data.runs.length === 0) {
        // Keep showing a run we have displayed if one is open
        if (currentRun) {
            return <RHSRunDetails runID={currentRun}/>;
        }

        // Otherwise show the home screen
        return <RHSHome/>;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRun && data.runs.find((run) => run.id === currentRun)) {
        return <RHSRunDetails runID={currentRun}/>;
    }

    // We have more than one run, and the currently selected run isn't in this channel.
    return (
        <RHSRunList
            runs={data.runs}
            onSelectRun={(runID: string) => {
                dispatch(setRHSViewingPlaybookRun());
                setCurrentRun(runID);
            }}
        />
    );
};

const RHSWrapped = () => {
    return (
        <ToastProvider>
            <RightHandSidebar/>
        </ToastProvider>
    );
};

export default RHSWrapped;

