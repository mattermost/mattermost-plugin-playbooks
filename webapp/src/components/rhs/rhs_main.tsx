// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import styled from 'styled-components';

import {setRHSOpen} from 'src/actions';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';

import {ToastProvider} from '../backstage/toast_banner';

import {useRhsActiveRunsQuery, useRhsFinishedRunsQuery} from 'src/graphql/generated_types';

import LoadingSpinner from '../assets/loading_spinner';

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
    const hasMoreInProgress = inProgressResult.data?.runs.pageInfo.hasNextPage ?? false;

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
    const hasMoreFinished = finishedResult.data?.runs.pageInfo.hasNextPage ?? false;

    const getMoreInProgress = () => {
        return inProgressResult.fetchMore({
            variables: {
                after: inProgressResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const getMoreFinished = () => {
        return finishedResult.fetchMore({
            variables: {
                after: finishedResult.data?.runs.pageInfo.endCursor,
            },
        });
    };

    const error = inProgressResult.error || finishedResult.error;

    return {
        runsInProgress,
        numRunsInProgress,
        runsFinished,
        numRunsFinished,
        getMoreInProgress,
        getMoreFinished,
        hasMoreInProgress,
        hasMoreFinished,
        error,
    };
};

const useSetRHSState = () => {
    const dispatch = useDispatch();

    // Let other parts of the app know if we are open or not
    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, [dispatch]);
};

const defaultListOptions : RunListOptions = {
    sort: 'create_at',
    direction: 'DESC',
    filter: FilterType.InProgress,
};

// RightHandSidebar the sidebar for integration of playbooks into channels
//
// Rules for automatic display:
// No Runs Ever -> RHS Home
// Only Finished Runs -> Runs list blank state
// Single active run (ignoring finished) -> Details page for that run (back button goes to runs list)
// Multiple active runs -> Runs list
const RightHandSidebar = () => {
    useSetRHSState();
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const [currentRunId, setCurrentRunId] = useState<string|undefined>();
    const [listOptions, setListOptions] = useState<RunListOptions>(defaultListOptions);
    const fetchedRuns = useFilteredSortedRuns(currentChannelId, listOptions);

    // If there is only one active run in this channel select it.
    useEffect(() => {
        if (fetchedRuns.runsInProgress && fetchedRuns.runsInProgress.length === 1) {
            const singleRunID = fetchedRuns.runsInProgress[0].id;
            if (singleRunID !== currentRunId) {
                setCurrentRunId(singleRunID);
            }
        }
    }, [currentChannelId, fetchedRuns.runsInProgress?.length]);

    // Reset the list options on channel change
    useEffect(() => {
        setListOptions(defaultListOptions);
    }, [currentChannelId]);

    if (!fetchedRuns.runsInProgress || !fetchedRuns.runsFinished) {
        return <RHSLoading/>;
    }

    const clearCurrentRunId = () => {
        setCurrentRunId(undefined);
    };

    // No runs (ever) in this channel
    if (fetchedRuns.numRunsInProgress + fetchedRuns.numRunsFinished === 0) {
        return <RHSHome/>;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRunId && [...fetchedRuns.runsInProgress, ...fetchedRuns.runsFinished].find((run) => run.id === currentRunId)) {
        return (
            <RHSRunDetails
                runID={currentRunId}
                onBackClick={clearCurrentRunId}
            />
        );
    }

    const runsList = listOptions.filter === FilterType.InProgress ? fetchedRuns.runsInProgress : (fetchedRuns.runsFinished ?? []);
    const getMoreRuns = listOptions.filter === FilterType.InProgress ? fetchedRuns.getMoreInProgress : fetchedRuns.getMoreFinished;
    const hasMore = listOptions.filter === FilterType.InProgress ? fetchedRuns.hasMoreInProgress : fetchedRuns.hasMoreFinished;

    // We have more than one run, and the currently selected run isn't in this channel.
    return (
        <RHSRunList
            runs={runsList}
            onSelectRun={(runID: string) => {
                setCurrentRunId(runID);
            }}
            options={listOptions}
            setOptions={setListOptions}
            getMore={getMoreRuns}
            hasMore={hasMore}
            numInProgress={fetchedRuns.numRunsInProgress}
            numFinished={fetchedRuns.numRunsFinished}
        />
    );
};

const RHSLoading = () => (
    <Centered>
        <LoadingSpinner/>
    </Centered>
);

const Centered = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
`;

const RHSWrapped = () => {
    return (
        <ToastProvider>
            <RightHandSidebar/>
        </ToastProvider>
    );
};

export default RHSWrapped;

