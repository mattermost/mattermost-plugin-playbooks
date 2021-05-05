// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {StyledTextarea} from 'src/components/backstage/styles';
import {
    PrimaryButtonRight,
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
    min-height: 200px;
    resize: vertical;
    font-size: 12px;
`;

interface ReportProps {
    incident: Incident;
}

const Report = (props: ReportProps) => {
    const [report, setReport] = useState(props.incident.retrospective);
    const [edited, setEdited] = useState(false);

    const saveDraftPressed = () => {
        updateRetrospective(props.incident.id, report);
        setEdited(false);
    };

    return (
        <TabPageContainer>
            <Header>
                <Title>{'Report'}</Title>
                <SaveButton
                    edited={edited}
                    onSave={saveDraftPressed}
                />
            </Header>
            <ReportTextarea
                value={report}
                onChange={(e) => {
                    setReport(e.target.value);
                    setEdited(true);
                }}
            />
        </TabPageContainer>
    );
};

interface SaveButtonProps {
    edited: boolean
    onSave: () => void
}

const TextContainer = styled.span`
    width: 65px;
    flex-grow: 1;
`;

const SaveButton = (props: SaveButtonProps) => {
    const [saved, setSaved] = useState(false);

    const doSave = () => {
        props.onSave();
        setSaved(true);
        setTimeout(() => setSaved(false), 1000);
    };

    if (props.edited || saved) {
        return (
            <PrimaryButtonRight
                onClick={doSave}
            >
                <TextContainer>{saved ? 'Saved!' : 'Save Draft'}</TextContainer>
            </PrimaryButtonRight>
        );
    }

    return (
        <SecondaryButtonRight>
            <TextContainer>{'Save Draft'}</TextContainer>
        </SecondaryButtonRight>
    );
};

export default Report;
