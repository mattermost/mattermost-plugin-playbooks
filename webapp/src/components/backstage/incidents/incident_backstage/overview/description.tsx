// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {
    Content,
    EmptyBody,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';
import {Incident} from 'src/types/incident';
import PostText from 'src/components/post_text';

const StyledContent = styled(Content)`
    font-size: 14px;
    margin: 8px 0 0 0;
    padding: 20px 24px 14px 24px;
`;

const Description = (props: { incident: Incident }) => {
    let description: JSX.Element = <EmptyBody>{'There is no description available.'}</EmptyBody>;
    if (props.incident.status_posts.length > 0 && props.incident.description) {
        description = (
            <StyledContent>
                <PostText text={props.incident.description}/>
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
