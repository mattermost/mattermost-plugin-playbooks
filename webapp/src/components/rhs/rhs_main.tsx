// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingPlaybookRun} from 'src/actions';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';

import {ToastProvider} from '../backstage/toast_banner';

import {useRhsActiveRunsQuery} from 'src/graphql/generated_types';

import RHSRunList, {RunListOptions} from './rhs_run_list';
import RHSHome from './rhs_home';

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const [currentRun, setCurrentRun] = useState<string|undefined>();
    const [listOptions, setListOptions] = useState<RunListOptions>({
        sort: 'create_at',
        direction: 'DESC',
    });
    const {data, error, fetchMore} = useRhsActiveRunsQuery({
        variables: {
            channelID: currentChannelId,
            sort: listOptions.sort,
            direction: listOptions.direction,
            first: 10,
        },
        fetchPolicy: 'cache-and-network',
    });
    const runs = data?.runs.edges.map((edge) => edge.node);

    const getMoreRuns = () => {
        fetchMore({
            variables: {
                after: data?.runs.pageInfo.endCursor,
            },
        });
    };

    // If there is only one run in this channel select it.
    useEffect(() => {
        if (runs && runs.length === 1) {
            const singleRunID = runs[0].id;
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

    if (error || !runs) {
        return null;
    }

    const clearCurrentRun = () => {
        setCurrentRun(undefined);
    };

    // No runs (ever) in this channel
    if (runs.length === 0) {
        // Keep showing a run we have displayed if one is open
        if (currentRun) {
            return (
                <RHSRunDetails
                    runID={currentRun}
                    onBackClick={clearCurrentRun}
                />
            );
        }

        // Otherwise show the home screen
        return <RHSHome/>;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRun && runs.find((run) => run.id === currentRun)) {
        return (
            <RHSRunDetails
                runID={currentRun}
                onBackClick={clearCurrentRun}
            />
        );
    }

    // We have more than one run, and the currently selected run isn't in this channel.
    return (
        <RHSRunList
            runs={runs}
            onSelectRun={(runID: string) => {
                dispatch(setRHSViewingPlaybookRun());
                setCurrentRun(runID);
            }}
            options={listOptions}
            setOptions={setListOptions}
            getMore={getMoreRuns}
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

