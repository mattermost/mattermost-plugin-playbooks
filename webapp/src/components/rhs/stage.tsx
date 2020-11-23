// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import styled, {css} from 'styled-components';

import {Incident} from 'src/types/incident';

const StageProgressBarElements = styled.div`
    display: flex;
    margin-top: 8px;
`;

interface StageProgressBarElementProps {
    active: boolean;
    finished: boolean;
}

const StageProgressBarElement = styled.div<StageProgressBarElementProps>`
    height: 8px;
    width: 100%;
    margin-right: 3px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);

    ${(props) => (props.active && css`
        background-color: rgba(var(--button-bg-rgb), 0.2);
    `)}

    ${(props) => (props.finished && css`
        background-color: var(--button-bg);
    `)}


    &:first-child {
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
    }

    &:last-child {
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
        margin-right: 0;
    }
`;

interface StageProps {
    incident: Incident;
}

const StageProgressBar: FC<StageProps> = (props: StageProps) => {
    const stages = props.incident.checklists || [];
    const activeStage = props.incident.active_stage;
    const isIncidentActive = props.incident.is_active;

    if (stages.length <= 1) {
        return null;
    }

    return (
        <StageProgressBarElements>
            {stages.map((_, index) => (
                <StageProgressBarElement
                    key={index}
                    active={activeStage === index}
                    finished={activeStage > index || !isIncidentActive}
                />
            ))}
        </StageProgressBarElements>
    );
};

const StageWrapper = styled.div`
    display: flex;
    justify-content: space-between;
`;

const StageCounter = styled.span`
    font-size: 14px;
    line-height: 20px;
    text-align: right;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const Stage: FC<StageProps> = (props: StageProps) => {
    const stages = props.incident.checklists || [];
    const activeStage = props.incident.active_stage;

    if (stages.length <= 1) {
        return null;
    }

    return (
        <div
            className='inner-container'
            id='incidentRHSStages'
        >
            <div className='title'>
                {'Current Stage:'}
            </div>
            <StageWrapper>
                {stages[activeStage].title}
                <StageCounter>
                    {`(${activeStage + 1}/${stages.length})`}
                </StageCounter>
            </StageWrapper>
            <StageProgressBar {...props}/>
        </div>
    );
};

export default Stage;
