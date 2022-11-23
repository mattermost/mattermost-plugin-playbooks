// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {setRHSOpen, setRHSViewingPlaybookRun} from 'src/actions';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';

import {ToastProvider} from '../backstage/toast_banner';

import {useRhsActiveRunsQuery, useRhsFinishedRunsQuery} from 'src/graphql/generated_types';

import RHSRunList, {FilterType, RunListOptions} from './rhs_run_list';
import RHSHome from './rhs_home';

const useFilteredSortedRuns = (channelID: string, listOptions: RunListOptions) => {
    const inProgressResult = useRhsActiveRunsQuery({
        variables: {
            channelID,
            sort: listOptions.sort,
            direction: listOptions.direction,
            first: 8,
        },
        fetchPolicy: 'cache-and-network',
    });
    const runsInProgress = inProgressResult.data?.runs.edges.map((edge) => edge.node);
    const numRunsInProgress = inProgressResult.data?.runs.totalCount ?? 0;

    const finishedResult = useRhsFinishedRunsQuery({
        variables: {
            channelID,
            sort: listOptions.sort,
            direction: listOptions.direction,
            first: 8,
        },
        fetchPolicy: 'cache-and-network',
    });
    const runsFinished = finishedResult.data?.runs.edges.map((edge) => edge.node);
    const numRunsFinished = finishedResult.data?.runs.totalCount ?? 0;

    const getMoreInProgress = () => {
        inProgressResult.fetchMore({
            variables: {
                after: inProgressResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const getMoreFinished = () => {
        finishedResult.fetchMore({
            variables: {
                after: finishedResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const error = inProgressResult.error || finishedResult.error;
    const fetchFinished = () => (true);

    return {
        runsInProgress,
        numRunsInProgress,
        runsFinished,
        numRunsFinished,
        getMoreInProgress,
        getMoreFinished,
        fetchFinished,
        error,
    };
};

const RightHandSidebar = () => {
    const dispatch = useDispatch();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const [currentRun, setCurrentRun] = useState<string|undefined>();
    const [listOptions, setListOptions] = useState<RunListOptions>({
        sort: 'create_at',
        direction: 'DESC',
        filter: FilterType.InProgress,
    });
    const fetchedRuns = useFilteredSortedRuns(currentChannelId, listOptions);

    // If there is only one run in this channel select it.
    useEffect(() => {
        if (fetchedRuns.runsInProgress && fetchedRuns.runsInProgress.length === 1) {
            const singleRunID = fetchedRuns.runsInProgress[0].id;
            if (singleRunID !== currentRun) {
                setCurrentRun(singleRunID);
            }
        }
    }, [fetchedRuns.runsInProgress]);

    // Let other parts of the app know if we are open or not
    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);

    if (!fetchedRuns.runsInProgress) {
        return null;
    }

    const clearCurrentRun = () => {
        setCurrentRun(undefined);
    };

    // No runs in this channel
    if (fetchedRuns.numRunsInProgress === 0) {
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
    if (currentRun && fetchedRuns.runsInProgress.find((run) => run.id === currentRun)) {
        return (
            <RHSRunDetails
                runID={currentRun}
                onBackClick={clearCurrentRun}
            />
        );
    }

    const runsList = listOptions.filter === FilterType.InProgress ? fetchedRuns.runsInProgress : (fetchedRuns.runsFinished ?? []);
    const getMoreRuns = listOptions.filter === FilterType.InProgress ? fetchedRuns.getMoreInProgress : fetchedRuns.getMoreFinished;

    // We have more than one run, and the currently selected run isn't in this channel.
    return (
        <RHSRunList
            runs={runsList}
            onSelectRun={(runID: string) => {
                dispatch(setRHSViewingPlaybookRun());
                setCurrentRun(runID);
            }}
            options={listOptions}
            setOptions={setListOptions}
            getMore={getMoreRuns}
            filterMenuOpened={fetchedRuns.fetchFinished}
            numInProgress={fetchedRuns.numRunsInProgress}
            numFinished={fetchedRuns.numRunsFinished}
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

