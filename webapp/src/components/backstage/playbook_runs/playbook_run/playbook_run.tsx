import React, {useState, useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';
import {useIntl} from 'react-intl';
import {Redirect, Route, useRouteMatch, Link, NavLink, Switch, useHistory} from 'react-router-dom';

import {
    clientFetchPlaybook,
    clientRemoveTimelineEvent,
    fetchPlaybookRun,
    fetchPlaybookRunMetadata,
    followPlaybookRun,
    unfollowPlaybookRun,
} from 'src/client';
import {useAllowRetrospectiveAccess, useForceDocumentTitle, useRun} from 'src/hooks';
import {PlaybookRun, Metadata as PlaybookRunMetadata, RunMetricData} from 'src/types/playbook_run';

import Summary from './summary';
import StatusUpdate from './status_update';
import Checklists from './checklists';
import FinishRun from './finish_run';
import Retrospective from './retrospective';

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const PlaybookRunDetails = () => {
    const {formatMessage} = useIntl();
    const match = useRouteMatch<{playbookRunId: string}>();
    const currentRun = useRun(match.params.playbookRunId);
    const [playbookRun, setPlaybookRun] = useState<PlaybookRun | null>(null);
    const [following, setFollowing] = useState<string[]>([]);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const [playbookRunMetadata, setPlaybookRunMetadata] = useState<PlaybookRunMetadata | null>(null);

    useEffect(() => {
        const playbookRunId = match.params.playbookRunId;

        if (currentRun) {
            setPlaybookRun(currentRun);
        } else {
            Promise.all([fetchPlaybookRun(playbookRunId), fetchPlaybookRunMetadata(playbookRunId)]).then(([playbookRunResult, playbookRunMetadataResult]) => {
                setPlaybookRun(playbookRunResult);
                if (playbookRunMetadataResult) {
                    setPlaybookRunMetadata(playbookRunMetadataResult);
                }
                setFetchingState(FetchingStateType.fetched);
                setFollowing(playbookRunMetadataResult && playbookRunMetadataResult.followers ? playbookRunMetadataResult.followers : []);
            }).catch(() => {
                setFetchingState(FetchingStateType.notFound);
            });
        }
    }, [match.params.playbookRunId, currentRun]);

    if (!currentRun) {
        return null;
    }

    return (
        <RowContainer>
            <Header>{'HEADER' + currentRun?.name}</Header>
            <Body>
                <Summary
                    playbookRun={currentRun}
                />
                <StatusUpdate/>
                <Checklists playbookRun={currentRun}/>
                <FinishRun/>
                <Retrospective/>
            </Body>
        </RowContainer>
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
const Header = styled.header`
    min-height: 56px;
    width: 100%;
`;

const Body = styled.main`
    max-width: 1120px;
    width: 1120px;
    padding: 20px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
`;
