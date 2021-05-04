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
import {Incident} from 'src/types/incident';
import {updateRetrospective} from 'src/client';

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const ReportTextarea = styled(StyledTextarea)`
    margin: 8px 0 0 0;
    height: 140px;
    font-size: 12px;
`;

interface Props {
    incident: Incident;
}

const Report = (props: Props) => {
    const [report, setReport] = useState(props.incident.retrospective);

    const saveDraftPressed = () => {
        updateRetrospective(props.incident.id, report);
    };

    return (
        <TabPageContainer>
            <Header>
                <Title>{'Report'}</Title>
                <SecondaryButtonRight
                    onClick={saveDraftPressed}
                >
                    {'Save Draft'}
                </SecondaryButtonRight>
            </Header>
            <ReportTextarea
                value={report}
                onChange={(e) => setReport(e.target.value)}
            />
        </TabPageContainer>
    );
};

export default Report;
