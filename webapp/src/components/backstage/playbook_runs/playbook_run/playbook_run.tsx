// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useRouteMatch} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    fetchPlaybookRunStatusUpdates,
} from 'src/client';
import {useRun} from 'src/hooks';
import {PlaybookRun, Metadata as PlaybookRunMetadata, StatusPostComplete} from 'src/types/playbook_run';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import Summary from './summary';
import {ParticipantStatusUpdate, ViewerStatusUpdate} from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';
import RightHandSidebar, {RHSContent} from './rhs';
import RHSStatusUpdates from './rhs_status_updates';

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const PlaybookRunDetails = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const match = useRouteMatch<{playbookRunId: string}>();
    const currentRun = useRun(match.params.playbookRunId);
    const [playbookRun, setPlaybookRun] = useState<PlaybookRun | null>(null);
    const [following, setFollowing] = useState<string[]>([]);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const [playbookRunMetadata, setPlaybookRunMetadata] = useState<PlaybookRunMetadata | null>(null);
    const [statusUpdates, setStatusUpdates] = useState<StatusPostComplete[]>([]);
    const [isRHSOpen, setIsRHSOpen] = useState(false);
    const [RHSSection, setRHSSection] = useState<RHSContent>(RHSContent.RunInfo);

    const myUser = useSelector(getCurrentUser);
    const getRHSTitle = (section: RHSContent) => {
        switch (section) {
        case RHSContent.RunInfo:
            return formatMessage({defaultMessage: 'Run info'});
        case RHSContent.RunTimeline:
            return formatMessage({defaultMessage: 'Timeline'});
        case RHSContent.RunParticipants:
            return formatMessage({defaultMessage: 'Participants'});
        case RHSContent.RunStatusUpdates:
            return formatMessage({defaultMessage: 'Status updates'});
        default:
            return '';
        }
    };

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
                    setFollowing(playbookRunMetadataResult && playbookRunMetadataResult.followers ? playbookRunMetadataResult.followers : []);
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

    return (
        <Container>
            <MainWrapper isRHSOpen={isRHSOpen}>
                <Main isRHSOpen={isRHSOpen}>
                    <Header>
                        {/* {'HEADER' + currentRun?.name}
                        <button onClick={() => setIsRHSOpen(!isRHSOpen)}> Toogle RHS</button> */}
                    </Header>
                    <Body>
                        <Summary
                            playbookRun={playbookRun}
                            role={role}
                        />
                        {role === Role.Participant ? (
                            <ParticipantStatusUpdate
                                onViewAllUpdates={() => {
                                    setIsRHSOpen(true);
                                    setRHSSection(RHSContent.RunStatusUpdates);
                                }}
                                playbookRun={playbookRun}
                            />
                        ) : (
                            <ViewerStatusUpdate
                                onViewAllUpdates={() => {
                                    setIsRHSOpen(true);
                                    setRHSSection(RHSContent.RunStatusUpdates);
                                }}
                                lastStatusUpdate={statusUpdates.length ? statusUpdates[0] : undefined}
                                playbookRun={playbookRun}
                            />
                        )}
                        <Checklists playbookRun={playbookRun}/>
                        {role === Role.Participant ? <FinishRun playbookRun={playbookRun}/> : null}
                        <Retrospective/>
                    </Body>
                </Main>
            </MainWrapper>
            <RightHandSidebar
                isOpen={isRHSOpen}
                title={getRHSTitle(RHSSection)}
                onClose={() => setIsRHSOpen(false)}
            >
                {RHSContent.RunStatusUpdates === RHSSection ? (
                    <RHSStatusUpdates
                        playbookRun={playbookRun}
                        statusUpdates={statusUpdates}
                    />
                ) : null}
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

const MainWrapper = styled.main<{isRHSOpen: boolean}>`
    flex: 1;
    display: flex;
    max-width: ${({isRHSOpen}) => (isRHSOpen ? 'calc(100% - 500px)' : '100%')};
`;

const Main = styled.main<{isRHSOpen: boolean}>`
    max-width: 780px;
    min-width: 500px;
    padding: 20px;
    flex: 1;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
`;
const Body = styled(RowContainer)`
`;

const Header = styled.header`
    min-height: 56px;
    width: 100%;
`;

