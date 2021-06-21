// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';

import {Badge, Content, TabPageContainer, Title} from 'src/components/backstage/playbook_runs/shared';

import Profile from 'src/components/profile/profile';

const StyledContent = styled(Content)`
    margin: 8px 0 0 0;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: 3fr 1fr 1fr 1fr;
    grid-template-rows: 1fr;
`;

const ColTitle = styled.div`
    font-weight: 600;
`;

const Cell = styled.div`
    padding-top: 8px;
`;

const SmallProfile = styled(Profile)`
    > .image {
        width: 16px;
        height: 16px;
    }
`;

const Line = styled.div`
    height: 1px;
    background: grey;
`;

// STUB COMPONENT. NOT IN ACTIVE USE YET
const Followups = (props: { playbookRun: PlaybookRun }) => {
    return (
        <TabPageContainer>
            <Title>{'Follow ups'}</Title>
            <StyledContent>
                <Grid>
                    <ColTitle>{'Description'}</ColTitle>
                    <ColTitle>{'Owner'}</ColTitle>
                    <ColTitle>{'Status'}</ColTitle>
                    <ColTitle>{'Jira issue'}</ColTitle>
                    <Line/>
                    <Line/>
                    <Line/>
                    <Line/>

                    <Cell>{'Improve our TTR by automating our OgsGenie webhooks.'}</Cell>
                    <Cell>
                        <SmallProfile userId={props.playbookRun.owner_user_id}/>
                    </Cell>
                    <Cell>
                        <Badge status={'Open' as PlaybookRunStatus}/>
                    </Cell>
                    <Cell>
                        <a href={''}>{'MM-42843'}</a>
                    </Cell>

                    <Cell>{'Notify affected customers sooner by collecting related Pagerduty events and DMing owner automatically.'}</Cell>
                    <Cell>
                        <SmallProfile userId={props.playbookRun.reporter_user_id}/>
                    </Cell>
                    <Cell>
                        <Badge status={'In Progress' as PlaybookRunStatus}/>
                    </Cell>
                    <Cell>
                        <a href={''}>{'MM-42850'}</a>
                    </Cell>
                </Grid>
            </StyledContent>
        </TabPageContainer>
    );
};

export default Followups;
