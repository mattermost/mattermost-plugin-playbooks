// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useUpdateEffect} from 'react-use';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {useLocation, useRouteMatch, Redirect} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {usePlaybook, useRun, useRunMetadata, useRunStatusUpdates, FetchState} from 'src/hooks';
import {Role} from 'src/components/backstage/playbook_runs/shared';
import {pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {PlaybookRun} from 'src/types/playbook_run';
import {usePlaybookRunViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookRunViewTarget} from 'src/types/telemetry';

import {useDefaultRedirectOnTeamChange} from 'src/components/backstage/main_body';

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

const useRHS = (playbookRun?: PlaybookRun|null) => {
    usePlaybookRunViewTelemetry(PlaybookRunViewTarget.Details, playbookRun?.id);
    const [isOpen, setIsOpen] = useState(true);
    const [scrollable, setScrollable] = useState(true);
    const [section, setSection] = useState<RHSContent>(RHSContent.RunInfo);
    const [title, setTitle] = useState<React.ReactNode>(RHSRunInfoTitle);
    const [subtitle, setSubtitle] = useState<React.ReactNode>(playbookRun?.name);
    const [onBack, setOnBack] = useState<() => void>();

    useUpdateEffect(() => {
        setSubtitle(playbookRun?.name);
    }, [playbookRun?.name]);

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

const PlaybookRunDetails = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const match = useRouteMatch<{playbookRunId: string}>();
    const playbookRunId = match.params.playbookRunId;
    const {hash: urlHash} = useLocation();
    const retrospectiveMetricId = urlHash.startsWith('#' + PlaybookRunIDs.SectionRetrospective) ? urlHash.substring(1 + PlaybookRunIDs.SectionRetrospective.length) : '';
    const playbookRun = useRun(playbookRunId);
    const playbook = usePlaybook(playbookRun?.playbook_id);
    const [metadata, metadataResult] = useRunMetadata(playbookRunId);
    const [statusUpdates] = useRunStatusUpdates(playbookRunId, [playbookRun?.status_posts.length]);
    const myUser = useSelector(getCurrentUser);

    const RHS = useRHS(playbookRun);

    useEffect(() => {
        const RHSUpdatesOpened = RHS.isOpen && RHS.section === RHSContent.RunStatusUpdates;
        const emptyUpdates = !playbookRun?.status_update_enabled || playbookRun.status_posts.length === 0;
        if (RHSUpdatesOpened && emptyUpdates) {
            RHS.open(RHSContent.RunInfo, RHSRunInfoTitle, playbookRun?.name);
        }
    }, [playbookRun, RHS.section, RHS.isOpen]);

    useEffect(() => {
        const teamId = playbookRun?.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
    }, [dispatch, playbookRun?.team_id]);

    useDefaultRedirectOnTeamChange(playbookRun?.team_id);

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

    // loading state
    if (playbookRun === undefined) {
        return null;
    }

    // not found or error
    if (playbookRun === null || metadataResult.state === FetchState.error) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOK_RUNS)}/>;
    }

    const role = playbookRun.participant_ids.includes(myUser.id) ? Role.Participant : Role.Viewer;

    const onViewInfo = () => RHS.open(RHSContent.RunInfo, formatMessage({defaultMessage: 'Run info'}), playbookRun.name);
    const onViewTimeline = () => RHS.open(RHSContent.RunTimeline, formatMessage({defaultMessage: 'Timeline'}), playbookRun.name, undefined, false);

    let rhsComponent = null;
    switch (RHS.section) {
    case RHSContent.RunStatusUpdates:
        rhsComponent = (
            <RHSStatusUpdates
                playbookRun={playbookRun}
                statusUpdates={statusUpdates ?? null}
            />
        );
        break;
    case RHSContent.RunInfo:
        rhsComponent = (
            <RHSInfo
                run={playbookRun}
                playbook={playbook ?? undefined}
                runMetadata={metadata ?? undefined}
                role={role}
                onViewParticipants={() => RHS.open(RHSContent.RunParticipants, formatMessage({defaultMessage: 'Participants'}), playbookRun.name, () => onViewInfo)}
                onViewTimeline={() => RHS.open(RHSContent.RunTimeline, formatMessage({defaultMessage: 'Timeline'}), playbookRun.name, () => onViewInfo, false)}
            />
        );
        break;
    case RHSContent.RunParticipants:
        rhsComponent = (
            <Participants
                participantsIds={playbookRun.participant_ids}
                playbookRunMetadata={metadata ?? null}
            />
        );
        break;
    case RHSContent.RunTimeline:
        rhsComponent = (
            <RHSTimeline
                playbookRun={playbookRun}
                role={role}
            />
        );
        break;
    default:
        rhsComponent = null;
    }

    const onInfoClick = RHS.isOpen && RHS.section === RHSContent.RunInfo ? RHS.close : onViewInfo;
    const onTimelineClick = RHS.isOpen && RHS.section === RHSContent.RunTimeline ? RHS.close : onViewTimeline;

    return (
        <Container isRHSOpen={RHS.isOpen}>
            <MainWrapper>
                <Header isRHSOpen={RHS.isOpen}>
                    <RunHeader
                        playbookRunMetadata={metadata ?? null}
                        playbookRun={playbookRun}
                        onInfoClick={onInfoClick}
                        onTimelineClick={onTimelineClick}
                        role={role}
                        rhsSection={RHS.isOpen ? RHS.section : null}
                    />
                </Header>
                <Main>
                    <Body>
                        <Summary
                            id={PlaybookRunIDs.SectionSummary}
                            playbookRun={playbookRun}
                            role={role}
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
                                lastStatusUpdate={statusUpdates?.length ? statusUpdates[0] : undefined}
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
                        {role === Role.Participant ? <FinishRun playbookRun={playbookRun}/> : null}
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
const ColumnContainer = styled.div`
    display: flex;
    flex-direction: row;
`;

const Container = styled(ColumnContainer)<{isRHSOpen: boolean}>`
    display: grid;
    grid-auto-flow: column;
    grid-template-columns: ${({isRHSOpen}) => (isRHSOpen ? 'auto 400px' : 'auto')};


    @media screen and (min-width: 1600px) {
        grid-template-columns: ${({isRHSOpen}) => (isRHSOpen ? 'auto 500px' : 'auto')};
    }
`;

const MainWrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const Main = styled.main`
    max-width: 780px;
    width: min(780px, 100%);
    padding: 20px;
    flex: 1;
    margin: 40px auto;
    display: flex;
    flex-direction: column;
`;
const Body = styled(RowContainer)`
`;

const Header = styled.header<{isRHSOpen: boolean}>`
    height: 56px;
    min-height: 56px;
    background-color: var(--center-channel-bg);
`;
