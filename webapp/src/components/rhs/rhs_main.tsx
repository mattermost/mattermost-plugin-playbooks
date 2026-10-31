// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import styled from 'styled-components';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import {setRHSOpen} from 'src/actions';
import RHSRunDetails from 'src/components/rhs/rhs_run_details';
import {ToastProvider} from 'src/components/backstage/toast_banner';
import {navigateToChannel} from 'src/browser_routing';
import {usePlaybooksCrud} from 'src/hooks';
import LoadingSpinner from 'src/components/assets/loading_spinner';
import {PlaybookRun, RunStatus} from 'src/types/playbook_run';
import {fetchPlaybookRuns} from 'src/client';
import {subscribeRHSRefresh} from 'src/rhs_refresh';

import RHSRunList, {FilterType, RunListOptions} from './rhs_run_list';
import RHSHome from './rhs_home';

export {notifyRHSRefresh, subscribeRHSRefresh} from 'src/rhs_refresh';

const pageSize = 8;

type RunListItem = {
    id: string
    name: string
    participantIDs: string[]
    ownerUserID: string
    playbookID: string
    playbook?: {title: string} | null
    numTasksClosed: number
    numTasks: number
    lastUpdatedAt: number
    type: PlaybookRun['type']
    currentStatus: RunStatus
    channelID: string
    teamID: string
};

function mapRun(run: PlaybookRun): RunListItem {
    return {
        id: run.id,
        name: run.name,
        participantIDs: run.participant_ids,
        ownerUserID: run.owner_user_id,
        playbookID: run.playbook_id,
        playbook: run.playbook_title ? {title: run.playbook_title} : null,
        numTasksClosed: run.task_completed ?? 0,
        numTasks: run.task_total ?? 0,
        lastUpdatedAt: run.update_at || run.create_at,
        type: run.type,
        currentStatus: run.current_status,
        channelID: run.channel_id,
        teamID: run.team_id,
    };
}

type StatusState = {
    runs: RunListItem[]
    total: number
    page: number
    hasMore: boolean
    loaded: boolean
};

const emptyStatusState = (): StatusState => ({
    runs: [],
    total: 0,
    page: 0,
    hasMore: false,
    loaded: false,
});

const useFilteredSortedRuns = (channelID: string, listOptions: RunListOptions) => {
    const [inProgress, setInProgress] = useState<StatusState>(emptyStatusState);
    const [finished, setFinished] = useState<StatusState>(emptyStatusState);
    const [error, setError] = useState<Error | undefined>();
    const [refreshKey, setRefreshKey] = useState(0);
    const latestRequest = useRef(0);
    const inFlightMore = useRef({inProgress: false, finished: false});

    const fetchStatus = useCallback(async (status: RunStatus, page: number, append: boolean) => {
        if (!channelID) {
            return;
        }
        const requestID = latestRequest.current;
        const result = await fetchPlaybookRuns({
            page,
            per_page: pageSize,
            channel_id: channelID,
            sort: listOptions.sort,
            direction: listOptions.direction,
            statuses: [status],
            skip_extras: true,
            include_playbook_title: true,
        });
        if (requestID !== latestRequest.current) {
            return;
        }
        const mapped = (result.items ?? []).map(mapRun);
        const apply = (prev: StatusState): StatusState => ({
            runs: append ? [...prev.runs, ...mapped] : mapped,
            total: result.total_count,
            page,
            hasMore: result.has_more,
            loaded: true,
        });

        if (status === RunStatus.InProgress) {
            setInProgress(apply);
        } else {
            setFinished(apply);
        }
    }, [channelID, listOptions.direction, listOptions.sort]);

    // Reset lists only when the channel changes so a refresh does not unmount
    // RHSRunDetails (Apollo refetch kept existing data visible).
    useEffect(() => {
        setInProgress(emptyStatusState());
        setFinished(emptyStatusState());
    }, [channelID]);

    useEffect(() => {
        latestRequest.current += 1;
        setError(undefined);

        (async () => {
            try {
                await Promise.all([
                    fetchStatus(RunStatus.InProgress, 0, false),
                    fetchStatus(RunStatus.Finished, 0, false),
                ]);
            } catch (err) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        })();
    }, [channelID, fetchStatus, refreshKey]);

    useEffect(() => subscribeRHSRefresh(() => setRefreshKey((key) => key + 1)), []);

    const getMoreInProgress = () => {
        if (!inProgress.hasMore || inFlightMore.current.inProgress) {
            return Promise.resolve();
        }
        inFlightMore.current.inProgress = true;
        return fetchStatus(RunStatus.InProgress, inProgress.page + 1, true).finally(() => {
            inFlightMore.current.inProgress = false;
        });
    };

    const getMoreFinished = () => {
        if (!finished.hasMore || inFlightMore.current.finished) {
            return Promise.resolve();
        }
        inFlightMore.current.finished = true;
        return fetchStatus(RunStatus.Finished, finished.page + 1, true).finally(() => {
            inFlightMore.current.finished = false;
        });
    };

    const refetch = () => setRefreshKey((key) => key + 1);

    return {
        runsInProgress: inProgress.loaded ? inProgress.runs : undefined,
        numRunsInProgress: inProgress.total,
        runsFinished: finished.loaded ? finished.runs : undefined,
        numRunsFinished: finished.total,
        getMoreInProgress,
        getMoreFinished,
        hasMoreInProgress: inProgress.hasMore,
        hasMoreFinished: finished.hasMore,
        refetch,
        error,
    };
};

const useSetRHSState = () => {
    const dispatch = useAppDispatch();

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
// * No Runs Ever -> RHS Home
// * Only Finished Runs -> Runs list blank state
// * Single active run (ignoring finished) -> Details page for that run (back button goes to runs list)
// * Multiple active runs -> Runs list
const RightHandSidebar = () => {
    useSetRHSState();
    const currentTeam = useAppSelector(getCurrentTeam);
    const currentChannelId = useAppSelector(getCurrentChannelId);
    const [currentRunId, setCurrentRunId] = useState<string | undefined>();
    const autoSelectCheckedForChannel = useRef<string | undefined>(undefined);
    const [autoAddTaskRunId, setAutoAddTaskRunId] = useState<string|undefined>();
    const [listOptions, setListOptions] = useState<RunListOptions>(defaultListOptions);
    const fetchedRuns = useFilteredSortedRuns(currentChannelId, listOptions);
    const {isLoading} = usePlaybooksCrud({team_id: currentTeam?.id}, {infinitePaging: true});

    useEffect(() => {
        // reset filter state and selection when leaving a channel so we never
        // auto-select against the previous channel's still-mounted run list.
        setListOptions(defaultListOptions);
        setCurrentRunId(undefined);
        autoSelectCheckedForChannel.current = undefined;
    }, [currentChannelId]);

    // auto-select single in-progress run in channel if applicable
    useEffect(() => {
        if (currentChannelId && currentChannelId !== autoSelectCheckedForChannel.current) {
            setCurrentRunId(() => {
                if (!fetchedRuns.runsInProgress) {
                    return undefined; // clear immediately - wait until runsInProgress is loaded
                }

                // Ignore stale lists from the previous channel that can still be
                // visible for one render before the channel-change reset commits.
                const runsForChannel = fetchedRuns.runsInProgress.filter((run) => run.channelID === currentChannelId);
                if (runsForChannel.length !== fetchedRuns.runsInProgress.length) {
                    return undefined;
                }

                autoSelectCheckedForChannel.current = currentChannelId; // mark that we've checked this channel

                if (runsForChannel.length === 1) {
                    return runsForChannel[0].id; // auto-select the single in-progress run
                }

                return undefined; // no auto-select
            });
        }
    }, [currentChannelId, fetchedRuns.runsInProgress]);

    if (!fetchedRuns.runsInProgress || !fetchedRuns.runsFinished) {
        return <RHSLoading/>;
    }

    const clearCurrentRunId = () => {
        fetchedRuns.refetch();
        setCurrentRunId(undefined);
    };

    const handleOnCreateRun = (runId: string, channelId: string, statsData: {autoAddTask?: boolean}) => {
        if (channelId === currentChannelId) {
            fetchedRuns.refetch();
            setCurrentRunId(runId);
            if (statsData.autoAddTask) {
                setAutoAddTaskRunId(runId);
            }
            return;
        }

        if (currentTeam) {
            navigateToChannel(currentTeam.name, channelId);
        }
    };

    // Not a channel
    if (!currentChannelId) {
        return <RHSHome/>;
    }

    // Wait for full load to avoid flashing
    if (isLoading) {
        return null;
    }

    // If we have a run selected and it's in the current channel show that
    if (currentRunId) {
        const currentRun = [...fetchedRuns.runsInProgress, ...fetchedRuns.runsFinished].find((run) => run.id === currentRunId);
        if (currentRun) {
            // Only auto-add task if this run matches autoAddTaskRunId AND the run is still in progress
            const shouldAutoAddTask = currentRunId === autoAddTaskRunId && currentRun.currentStatus === RunStatus.InProgress;
            return (
                <RHSRunDetails
                    runID={currentRunId}
                    onBackClick={clearCurrentRunId}
                    autoAddTask={shouldAutoAddTask}
                    onTaskAdded={() => setAutoAddTaskRunId(undefined)}
                />
            );
        }
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
            onRunCreated={handleOnCreateRun}
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
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
`;

const RHSWrapped = () => {
    return (
        <ToastProvider>
            <RightHandSidebar/>
        </ToastProvider>
    );
};

export default RHSWrapped;
