// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

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
`;

const Description = (props: { playbookRun: PlaybookRun }) => {
    let description: JSX.Element = <EmptyBody>{'There is no description available.'}</EmptyBody>;
    if (props.playbookRun.status_posts.length > 0 && props.playbookRun.description) {
        description = (
            <StyledContent>
                <PostText text={props.playbookRun.description}/>
            </StyledContent>
        );
    }

    return (
        <TabPageContainer>
            <Title>{'Description'}</Title>
            {description}
        </TabPageContainer>
    );
};

export default Description;
