// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Content, TabPageContainer, Title} from 'src/components/backstage/playbook_runs/shared';

const Centered = styled.div`
    padding: 10px 60px 0;
    text-align: center;
`;

const Metrics = () => {
    return (
        <TabPageContainer>
            <Title>{'Metrics'}</Title>
            <Content>
                <Centered>
                    <img src={'https://i.imgur.com/NDaVWcc.png'}/>
                </Centered>
            </Content>
        </TabPageContainer>
    );
};

export default Metrics;
