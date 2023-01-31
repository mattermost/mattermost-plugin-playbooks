// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useUpdateEffect} from 'react-use';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {Redirect, useLocation, useRouteMatch} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import qs from 'qs';

import {useQuery} from '@apollo/client';

import {GlobalState} from '@mattermost/types/store';

import {
    useChannel,
    useEnsureProfiles,
    usePlaybook,
    useRunFollowers,
} from 'src/hooks';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {PlaybookRunViewTarget} from 'src/types/telemetry';
import {useViewTelemetry} from 'src/hooks/telemetry';
import {useDefaultRedirectOnTeamChange} from 'src/components/backstage/main_body';
import {useFilter} from 'src/components/backstage/playbook_runs/playbook_run/timeline_utils';

import {graphql} from 'src/graphql/generated';

import Summary from './summary';
import {ParticipantStatusUpdate, ViewerStatusUpdate} from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';
import {RunHeader} from './header';
import RightHandSidebar, {RHSContent} from './rhs';
import RHSStatusUpdates from './rhs_status_updates';
import RHSInfo from './rhs_info';
import {Participants} from './rhs_participants';
import RHSTimeline from './rhs_timeline';

const RHSRunInfoTitle = <FormattedMessage defaultMessage={'Run info'}/>;
const RHSParticipantsTitle = <FormattedMessage defaultMessage={'Participants'}/>;
const useRHS = (runName?: string) => {
    const [isOpen, setIsOpen] = useState(true);
    const [scrollable, setScrollable] = useState(true);
    const [section, setSection] = useState<RHSContent>(RHSContent.RunInfo);
    const [title, setTitle] = useState<React.ReactNode>(RHSRunInfoTitle);
    const [subtitle, setSubtitle] = useState<React.ReactNode>(runName);
    const [onBack, setOnBack] = useState<() => void>();

    useUpdateEffect(() => {
        setSubtitle(runName);
    }, [runName]);

    const open = (_section: RHSContent, _title: React.ReactNode, _subtitle?: React.ReactNode, _onBack?: () => void, _scrollable = true) => {
        setIsOpen(true);
        setSection(_section);
        setTitle(_title);
        setSubtitle(_subtitle);
        setOnBack(_onBack);
        setScrollable(_scrollable);
    };
    const close = () => {
        setIsOpen(false);
    };

    return {isOpen, section, title, subtitle, open, close, onBack, scrollable};
};

export enum PlaybookRunIDs {
    SectionSummary = 'playbook-run-summary',
    SectionStatusUpdate = 'playbook-run-status-update',
    SectionChecklists = 'playbook-run-checklists',
    SectionRetrospective = 'playbook-run-retrospective',
}

/*
            id
            name
            teamID
            participantIDs
            statusPosts {
                id
                createAt
                message
                authorUserName
            }
            channelID
            ownerUserID
            statusUpdateEnabled
            playbookID
            playbook {
                id
            }
 */

const runDetailsPageQuery = graphql(/* GraphQL */`
    query RunDetailsPage($runID: String!) {
        run(id: $runID) {
            id
            participantIDs
            ownerUserID
            channelID
            playbookID
            teamID
            name
            statusPosts {
                id
                authorUserName
                createAt
                message
            }
            statusUpdateEnabled
            summaryModifiedAt
            endAt
            summary
            checklists {
                items {
                    state
                }
            }
            currentStatus
            followers
            ...RHSInfo
            ...ParticipantsRun
            ...RHSTimelineRun
            ...RunHeaderRun
        }
    }
`);

const teamNameSelector = (teamId: string) => (state: GlobalState): string => getTeam(state, teamId).name;

const PlaybookRunDetails = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const match = useRouteMatch<{playbookRunId: string}>();
    const {hash: urlHash} = useLocation();
    const retrospectiveMetricId = urlHash.startsWith('#' + PlaybookRunIDs.SectionRetrospective) ? urlHash.substring(1 + PlaybookRunIDs.SectionRetrospective.length) : '';

    const {data, loading, error} = useQuery(runDetailsPageQuery, {
        variables: {
            runID: match.params.playbookRunId,
        },
    });
    const playbookRun = data?.run;
    const [playbook] = usePlaybook(playbookRun?.playbookID);

    const [channel] = useChannel(playbookRun?.channelID ?? '');
    const teamName = useSelector(teamNameSelector(playbookRun?.teamID ?? ''));
    const myUser = useSelector(getCurrentUser);
    const {options, selectOption, eventsFilter, resetFilters} = useFilter();
    const followState = useRunFollowers(playbookRun?.followers || []);
    const hasPermanentViewerAccess = playbook?.public || playbook?.members.find((m) => m.user_id === myUser.id) !== undefined;

    const queryParams = qs.parse(location.search, {ignoreQueryPrefix: true});
    const role = playbookRun?.participantIDs.includes(myUser.id) || playbookRun?.ownerUserID === myUser.id ? Role.Participant : Role.Viewer;

    useEnsureProfiles(playbookRun?.participantIDs ?? []);
    useViewTelemetry(PlaybookRunViewTarget.Details, playbookRun?.id, {
        from: queryParams.from ?? '',
        playbook_id: playbookRun?.playbookID,
        playbookrun_id: playbookRun?.id,
        role,
    });

    const RHS = useRHS(playbookRun?.name);

    useUpdateEffect(() => {
        resetFilters();
    }, [match.params.playbookRunId]);

    useEffect(() => {
        const RHSUpdatesOpened = RHS.isOpen && RHS.section === RHSContent.RunStatusUpdates;
        const emptyUpdates = !playbookRun?.statusUpdateEnabled || playbookRun.statusPosts.length === 0;
        if (queryParams.from === 'channel_rhs_participants') {
            RHS.open(RHSContent.RunParticipants, RHSParticipantsTitle, playbookRun?.name);
        } else if (RHSUpdatesOpened && emptyUpdates) {
            RHS.open(RHSContent.RunInfo, RHSRunInfoTitle, playbookRun?.name);
        }
    }, [playbookRun, RHS.section, RHS.isOpen]);

    useEffect(() => {
        const teamId = playbookRun?.teamID;
        if (!teamId) {
            return;
        }
        dispatch(selectTeam(teamId));
    }, [dispatch, playbookRun?.teamID]);

    useDefaultRedirectOnTeamChange(playbookRun?.teamID);

    // When first loading the page, the element with the ID corresponding to the URL
    // hash is not mounted, so the browser fails to automatically scroll to such section.
    // To fix this, we need to manually scroll to the component
    useEffect(() => {
        if (urlHash !== '') {
            setTimeout(() => {
                document.querySelector(urlHash)?.scrollIntoView();
            }, 300);
        }
    }, [urlHash]);

    // not found or error
    if (error) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOK_RUNS)}/>;
    }

    // loading state
    if (!playbookRun) {
        return null;
    }

    const onViewInfo = () => RHS.open(RHSContent.RunInfo, formatMessage({defaultMessage: 'Run info'}), playbookRun.name);
    const onViewTimeline = () => RHS.open(RHSContent.RunTimeline, formatMessage({defaultMessage: 'Timeline'}), playbookRun.name, undefined, false);

    let rhsComponent = null;
    switch (RHS.section) {
    case RHSContent.RunStatusUpdates:
        rhsComponent = (
            <RHSStatusUpdates
                statusUpdates={playbookRun.statusPosts}
            />
        );
        break;
    case RHSContent.RunInfo:
        rhsComponent = (
            <RHSInfo
                run={playbookRun}
                playbook={playbook ?? undefined}
                role={role}
                followState={followState}
                channel={channel}
                onViewParticipants={() => RHS.open(RHSContent.RunParticipants, RHSParticipantsTitle, playbookRun.name, () => onViewInfo)}
                onViewTimeline={() => RHS.open(RHSContent.RunTimeline, formatMessage({defaultMessage: 'Timeline'}), playbookRun.name, () => onViewInfo, false)}
            />
        );
        break;
    case RHSContent.RunParticipants:
        rhsComponent = (
            <Participants
                playbookRun={playbookRun}
                role={role}
                teamName={teamName}
            />
        );
        break;
    case RHSContent.RunTimeline:
        rhsComponent = (
            <RHSTimeline
                playbookRunFragment={playbookRun}
                role={role}
                options={options}
                selectOption={selectOption}
                eventsFilter={eventsFilter}
            />
        );
        break;
    default:
        rhsComponent = null;
    }

    const onInfoClick = RHS.isOpen && RHS.section === RHSContent.RunInfo ? RHS.close : onViewInfo;
    const onTimelineClick = RHS.isOpen && RHS.section === RHSContent.RunTimeline ? RHS.close : onViewTimeline;

    return (
        <Container>
            <MainWrapper>
                <Header>
                    <RunHeader
                        runFragment={playbookRun}
                        onInfoClick={onInfoClick}
                        onTimelineClick={onTimelineClick}
                        role={role}
                        hasPermanentViewerAccess={hasPermanentViewerAccess}
                        rhsSection={RHS.isOpen ? RHS.section : null}
                        isFollowing={followState.isFollowing}
                    />
                </Header>
                <Main>
                    <Body>
                        <Summary
                            id={PlaybookRunIDs.SectionSummary}
                            role={role}
                            runID={playbookRun.id}
                            summaryModifiedAt={playbookRun.summaryModifiedAt}
                            endAt={playbookRun.endAt}
                            summary={playbookRun.summary}
                        />
                        {role === Role.Participant ? (
                            <ParticipantStatusUpdate
                                id={PlaybookRunIDs.SectionStatusUpdate}
                                openRHS={RHS.open}
                                playbookRun={playbookRun}
                            />
                        ) : (
                            <ViewerStatusUpdate
                                id={PlaybookRunIDs.SectionStatusUpdate}
                                openRHS={RHS.open}
                                lastStatusUpdate={playbookRun.statusPosts[0] ?? undefined}
                                playbookRun={playbookRun}
                            />
                        )}
                        <Checklists
                            id={PlaybookRunIDs.SectionChecklists}
                            playbookRun={playbookRun}
                            role={role}
                        />
                        <Retrospective
                            id={PlaybookRunIDs.SectionRetrospective}
                            playbookRun={playbookRun}
                            playbook={playbook ?? null}
                            role={role}
                            focusMetricId={retrospectiveMetricId}
                        />
                        {role === Role.Participant ? (
                            <FinishRun
                                checklists={playbookRun.checklists}
                                runName={playbookRun.name}
                                runID={playbookRun.id}
                                currentStatus={playbookRun.currentStatus}
                            />
                        ) : null
                        }
                    </Body>
                </Main>
            </MainWrapper>
            <RightHandSidebar
                isOpen={RHS.isOpen}
                title={RHS.title}
                subtitle={RHS.subtitle}
                onClose={RHS.close}
                onBack={RHS.onBack}
                scrollable={RHS.scrollable}
            >
                {rhsComponent}
            </RightHandSidebar>
        </Container>
    );
};

export default PlaybookRunDetails;

const RowContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

const Container = styled.div`
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(400px, 2fr) minmax(400px, 1fr);
    overflow-y: hidden;

    @media screen and (min-width: 1600px) {
        grid-auto-columns: 2.5fr 500px;
    }
`;

const MainWrapper = styled.div`
    display: grid;
    grid-template-rows: 56px 1fr;
    grid-auto-flow: row;
    overflow-y: hidden;
    grid-auto-columns: minmax(0, 1fr);
`;

const Main = styled.main`
    min-height: 0;
    padding: 0 20px 60px;
    display: grid;
    overflow-y: auto;
    place-content: start center;
    grid-auto-columns: min(780px, 100%);
`;
const Body = styled(RowContainer)`
`;

const Header = styled.header`
    height: 56px;
    min-height: 56px;
    background-color: var(--center-channel-bg);
`;
