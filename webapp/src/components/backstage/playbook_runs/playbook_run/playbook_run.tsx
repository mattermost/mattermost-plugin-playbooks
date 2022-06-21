// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {useRouteMatch} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    fetchPlaybookRunStatusUpdates,
} from 'src/client';
import {usePlaybook, useRun} from 'src/hooks';
import {PlaybookRun, Metadata as PlaybookRunMetadata, StatusPostComplete} from 'src/types/playbook_run';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import Summary from './summary';
import {ParticipantStatusUpdate, ViewerStatusUpdate} from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';
import {RunHeader} from './header';
import RightHandSidebar, {RHSContent} from './rhs';
import RHSStatusUpdates from './rhs_status_updates';
import RHSInfo from './rhs_info';

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const useRHS = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [section, setSection] = useState<RHSContent>(RHSContent.RunInfo);
    const [title, setTitle] = useState<React.ReactNode>(null);

    const open = (_section: RHSContent, _title: React.ReactNode) => {
        setIsOpen(true);
        setSection(_section);
        setTitle(_title);
    };
    const close = () => {
        setIsOpen(false);
    };

    return {isOpen, section, title, open, close};
};

const PlaybookRunDetails = () => {
    const dispatch = useDispatch();
    const match = useRouteMatch<{playbookRunId: string}>();
    const currentRun = useRun(match.params.playbookRunId);
    const [playbookRun, setPlaybookRun] = useState<PlaybookRun | null>(null);
    const playbook = usePlaybook(playbookRun?.playbook_id);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const [playbookRunMetadata, setPlaybookRunMetadata] = useState<PlaybookRunMetadata | null>(null);
    const [statusUpdates, setStatusUpdates] = useState<StatusPostComplete[]>([]);

    const RHS = useRHS();

    const myUser = useSelector(getCurrentUser);

    useEffect(() => {
        const playbookRunId = match.params.playbookRunId;

        if (currentRun) {
            // re-download status updates if status_posts size is different
            if (playbookRun && currentRun.status_posts.length !== playbookRun.status_posts.length) {
                fetchPlaybookRunStatusUpdates(playbookRunId).then((statusUpdatesResult) => {
                    setStatusUpdates(statusUpdatesResult || []);
                });
            }
            setPlaybookRun(currentRun);
        } else {
            Promise
                .all([
                    fetchPlaybookRun(playbookRunId),
                    fetchPlaybookRunMetadata(playbookRunId),
                    fetchPlaybookRunStatusUpdates(playbookRunId),
                ])
                .then(([playbookRunResult, playbookRunMetadataResult, statusUpdatesResult]) => {
                    setPlaybookRun(playbookRunResult);
                    setPlaybookRunMetadata(playbookRunMetadataResult || null);
                    setFetchingState(FetchingStateType.fetched);
                    setStatusUpdates(statusUpdatesResult || []);
                }).catch(() => {
                    setFetchingState(FetchingStateType.notFound);
                });
        }
    }, [match.params.playbookRunId, currentRun]);

    useEffect(() => {
        const teamId = playbookRun?.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
    }, [dispatch, playbookRun?.team_id]);

    if (!playbookRun) {
        return null;
    }

    // TODO: triple-check this assumption, can we rely on participant_ids?
    const role = playbookRun.participant_ids.includes(myUser.id) ? Role.Participant : Role.Viewer;

    let rhsComponent = null;
    switch (RHS.section) {
    case RHSContent.RunStatusUpdates:
        rhsComponent = (
            <RHSStatusUpdates
                playbookRun={playbookRun}
                statusUpdates={statusUpdates}
            />
        );
        break;
    case RHSContent.RunInfo:
        rhsComponent = (
            <RHSInfo
                run={playbookRun}
                runMetadata={playbookRunMetadata}
            />
        );
        break;
    default:
        rhsComponent = null;
    }

    return (
        <Container>
            <MainWrapper isRHSOpen={RHS.isOpen}>
                <Header>
                    <RunHeader
                        playbookRun={playbookRun}
                        playbookRunMetadata={playbookRunMetadata}
                        openRHS={RHS.open}
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
                                lastStatusUpdate={statusUpdates.length ? statusUpdates[0] : undefined}
                                playbookRun={playbookRun}
                            />
                        )}
                        <Checklists playbookRun={playbookRun}/>
                        {role === Role.Participant ? <FinishRun playbookRun={playbookRun}/> : null}
                        <Retrospective
                            playbookRun={playbookRun}
                            playbook={playbook ?? null}
                            onChange={setPlaybookRun}
                            role={role}
                        />
                    </Body>
                </Main>
            </MainWrapper>
            <RightHandSidebar
                isOpen={RHS.isOpen}
                title={RHS.title}
                onClose={RHS.close}
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
    max-width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 500px)' : '100%')};
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

const Header = styled.header`
    height: 56px;
    min-height: 56px;
    width: calc(100% - 239px);
    z-index: 2;
    position: fixed;
    background-color: var(--center-channel-bg);
    display:flex;
`;
