// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';
import {useRouteMatch, Redirect} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {useUpdateEffect} from 'react-use';

import {usePlaybook, useRun, useRunMetadata, useRunStatusUpdates, FetchState} from 'src/hooks';

import {Role} from 'src/components/backstage/playbook_runs/shared';
import {pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {PlaybookRun} from 'src/types/playbook_run';

import Summary from './summary';
import {ParticipantStatusUpdate, ViewerStatusUpdate} from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';
import {RunHeader} from './header';
import RightHandSidebar, {RHSContent} from './rhs';
import RHSStatusUpdates from './rhs_status_updates';
import RHSInfo from './rhs_info';
import RHSTimeline from './rhs_timeline';

const RHSRunInfoTitle = <FormattedMessage defaultMessage={'Run info'}/>;

const useRHS = (playbookRun?: PlaybookRun|null) => {
    const [isOpen, setIsOpen] = useState(true);
    const [scrollable, setScrollable] = useState(true);
    const [section, setSection] = useState<RHSContent>(RHSContent.RunInfo);
    const [title, setTitle] = useState<React.ReactNode>(RHSRunInfoTitle);
    const [subtitle, setSubtitle] = useState<React.ReactNode>(playbookRun?.name);

    useUpdateEffect(() => {
        setSubtitle(playbookRun?.name);
    }, [playbookRun?.name]);

    const open = (_section: RHSContent, _title: React.ReactNode, _subtitle?: React.ReactNode, _scrollable = true) => {
        setIsOpen(true);
        setSection(_section);
        setTitle(_title);
        setSubtitle(_subtitle);
        setScrollable(_scrollable);
    };
    const close = () => {
        setIsOpen(false);
    };

    return {isOpen, section, title, subtitle, scrollable, open, close};
};

const PlaybookRunDetails = () => {
    const dispatch = useDispatch();
    const match = useRouteMatch<{playbookRunId: string}>();
    const playbookRunId = match.params.playbookRunId;
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

    // loading state
    if (playbookRun === undefined) {
        return null;
    }

    // not found or error
    if (playbookRun === null || metadataResult.state === FetchState.error) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOK_RUNS)}/>;
    }

    // TODO: triple-check this assumption, can we rely on participant_ids?
    const role = playbookRun.participant_ids.includes(myUser.id) ? Role.Participant : Role.Viewer;

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
                runMetadata={metadata ?? null}
                role={role}
            />
        );
        break;
    case RHSContent.RunTimeline:
        rhsComponent = (
            <RHSTimeline
                playbookRun={playbookRun}
            />
        );
        break;
    default:
        rhsComponent = null;
    }

    return (
        <Container>
            <MainWrapper isRHSOpen={RHS.isOpen}>
                <Header isRHSOpen={RHS.isOpen}>
                    <RunHeader
                        playbookRun={playbookRun}
                        playbookRunMetadata={metadata ?? null}
                        openRHS={RHS.open}
                        role={role}
                    />
                </Header>
                <Main isRHSOpen={RHS.isOpen}>
                    <Body>
                        <Summary
                            playbookRun={playbookRun}
                            role={role}
                        />
                        {role === Role.Participant ? (
                            <ParticipantStatusUpdate
                                openRHS={RHS.open}
                                playbookRun={playbookRun}
                            />
                        ) : (
                            <ViewerStatusUpdate
                                openRHS={RHS.open}
                                lastStatusUpdate={statusUpdates?.length ? statusUpdates[0] : undefined}
                                playbookRun={playbookRun}
                            />
                        )}
                        <Checklists
                            playbookRun={playbookRun}
                            role={role}
                        />
                        {role === Role.Participant ? <FinishRun playbookRun={playbookRun}/> : null}
                        <Retrospective
                            playbookRun={playbookRun}
                            playbook={playbook ?? null}
                            role={role}
                        />
                    </Body>
                </Main>
            </MainWrapper>
            <RightHandSidebar
                isOpen={RHS.isOpen}
                title={RHS.title}
                subtitle={RHS.subtitle}
                onClose={RHS.close}
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

const Container = styled(ColumnContainer)`
    flex: 1;
`;

const MainWrapper = styled.div<{isRHSOpen: boolean}>`
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 400px)' : '100%')};

    @media screen and (min-width: 1600px) {
        max-width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 500px)' : '100%')};
    }
`;

const Main = styled.main<{isRHSOpen: boolean}>`
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
    width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 639px)' : 'calc(100% - 239px)')};
    z-index: 2;
    position: fixed;
    background-color: var(--center-channel-bg);
    display:flex;

    @media screen and (min-width: 1600px) {
        width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 739px)' : 'calc(100% - 239px)')};
    }
`;
