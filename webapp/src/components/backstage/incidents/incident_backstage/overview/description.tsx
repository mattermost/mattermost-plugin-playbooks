// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';
import {Incident} from 'src/types/incident';
import PostText from 'src/components/post_text';

const Description = (props: {incident: Incident}) => {
    return (
        <TabPageContainer>
            <Title>{'Description'}</Title>
            <Content>
                <PostText text={props.incident.description}/>
            </Content>
        </TabPageContainer>
    );
};

export default Description;
