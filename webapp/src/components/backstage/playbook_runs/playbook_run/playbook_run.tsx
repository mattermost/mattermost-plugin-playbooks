// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useRouteMatch} from 'react-router-dom';
import {selectTeam} from 'mattermost-webapp/packages/mattermost-redux/src/actions/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {usePlaybook, useRun, useRunMetadata, useRunStatusUpdates} from 'src/hooks';

import {Role} from 'src/components/backstage/playbook_runs/shared';

import Summary from './summary';
import {ParticipantStatusUpdate, ViewerStatusUpdate} from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';
import {RunHeader} from './header';
import RightHandSidebar, {RHSContent} from './rhs';
import RHSStatusUpdates from './rhs_status_updates';

const useRHS = () => {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(true);
    const [section, setSection] = useState<RHSContent>(RHSContent.RunInfo);
    const [title, setTitle] = useState<React.ReactNode>(formatMessage({defaultMessage: 'Run info'}));

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
    const {formatMessage} = useIntl();
    const match = useRouteMatch<{playbookRunId: string}>();
    const playbookRunId = match.params.playbookRunId;
    const playbookRun = useRun(playbookRunId);
    const playbook = usePlaybook(playbookRun?.playbook_id);
    const metadata = useRunMetadata(playbookRunId);
    const statusUpdates = useRunStatusUpdates(playbookRunId, [playbookRun?.status_posts.length]);
    const myUser = useSelector(getCurrentUser);

    const RHS = useRHS();

    useEffect(() => {
        const RHSUpdatesOpened = RHS.isOpen && RHS.section === RHSContent.RunStatusUpdates;
        const emptyUpdates = !playbookRun?.status_update_enabled || playbookRun.status_posts.length === 0;
        if (RHSUpdatesOpened && emptyUpdates) {
            RHS.open(RHSContent.RunInfo, formatMessage({defaultMessage: 'Run info'}));
        }
    }, [playbookRun, RHS.section, RHS.isOpen]);

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
            <MainWrapper isRHSOpen={RHS.isOpen}>
                <Header>
                    <RunHeader
                        playbookRun={playbookRun}
                        playbookRunMetadata={metadata ?? null}
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
                                lastStatusUpdate={statusUpdates?.length ? statusUpdates[0] : undefined}
                                playbookRun={playbookRun}
                            />
                        )}
                        <Checklists playbookRun={playbookRun}/>
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
                onClose={RHS.close}
            >
                {RHSContent.RunStatusUpdates === RHS.section ? (
                    <RHSStatusUpdates
                        playbookRun={playbookRun}
                        statusUpdates={statusUpdates ?? null}
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
