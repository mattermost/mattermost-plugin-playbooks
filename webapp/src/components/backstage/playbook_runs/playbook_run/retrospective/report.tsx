// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';
import {useIntl} from 'react-intl';

import ReportTextArea from 'src/components/backstage/playbook_runs/playbook_run/retrospective/report_text_area';

interface ReportProps {
    teamID: string
    retrospective: string
    notEditable: boolean;
    onEdit: (report: string) => void;
    flushChanges: () => void;
}

const Report = (props: ReportProps) => {
    const {formatMessage} = useIntl();
    return (
        <ReportContainer>
            <Header>
                <Title>{formatMessage({defaultMessage: 'Report'})}</Title>
            </Header>
            <ReportTextArea
                teamId={props.teamID}
                text={props.retrospective}
                isEditable={!props.notEditable}
                onEdit={props.onEdit}
                flushChanges={props.flushChanges}
            />
        </ReportContainer>
    );
};

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const ReportContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-bottom: 20px;
    margin-top: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
`;

const Title = styled.div`
    font-weight: 600;
    font-size: 14px;
`;

export default Report;
