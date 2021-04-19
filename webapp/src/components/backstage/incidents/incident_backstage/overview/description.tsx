// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    Content,
    EmptyBody,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';
import {Incident} from 'src/types/incident';
import PostText from 'src/components/post_text';

const Description = (props: { incident: Incident }) => {
    let description: JSX.Element = <EmptyBody>{'There is no description available.'}</EmptyBody>;
    if (props.incident.description) {
        description = (
            <Content>
                <PostText text={props.incident.description}/>
            </Content>
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
