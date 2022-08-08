// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';
import {useIntl} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';

import {
    Content,
    EmptyBody,
    TabPageContainer,
    Title,
} from 'src/components/backstage/playbook_runs/shared';

import PostText from 'src/components/post_text';

const StyledContent = styled(Content)`
    font-size: 14px;
    margin: 8px 0 0 0;
    padding: 20px 24px 14px 24px;

    p {
        white-space: pre-wrap;
    }
`;

interface MatchParams {
    playbookRunId: string
}

const Description = (props: { playbookRun: PlaybookRun }) => {
    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));
    let summary: JSX.Element = <EmptyBody>{formatMessage({defaultMessage: 'There is no run summary available.'})}</EmptyBody>;
    if (props.playbookRun.summary) {
        summary = (
            <StyledContent>
                <PostText
                    text={props.playbookRun.summary}
                    team={team}
                />
            </StyledContent>
        );
    }

    return (
        <TabPageContainer>
            <Title>{formatMessage({defaultMessage: 'Run Summary'})}</Title>
            {summary}
        </TabPageContainer>
    );
};

export default Description;
