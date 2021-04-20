// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {StyledTextarea} from 'src/components/backstage/styles';
import {
    SecondaryButtonRight,
    TabPageContainer,
    Title,
} from 'src/components/backstage/incidents/shared';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const ReportTextarea = styled(StyledTextarea)`
    margin: 8px 0 0 0;
    height: 140px;
    font-size: 12px;
`;

const Report = () => {
    const [report, setReport] = useState('# What happened\n\n# Root cause\n\n# Recovery');

    return (
        <TabPageContainer>
            <Header>
                <Title>{'Report'}</Title>
                <SecondaryButtonRight>{'Publish'}</SecondaryButtonRight>
            </Header>
            <ReportTextarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
            />
        </TabPageContainer>
    );
};

export default Report;
