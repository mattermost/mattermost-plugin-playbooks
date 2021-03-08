// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import {Client4} from 'mattermost-redux/client';
import {Post} from 'mattermost-redux/types/posts';
import {GlobalState} from 'mattermost-redux/types/store';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import Profile from 'src/components/profile/profile';
import Duration from 'src/components/duration';
import {Incident, incidentCurrentStatus} from 'src/types/incident';
import {lastUpdatedByIncidentId} from 'src/selectors';
import StatusBadge from '../backstage/incidents/status_badge';

const IncidentContainer = styled.div<IncidentContainerProps>`
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-24);

    ${(props) => props.active && css`
        box-shadow: inset 0px -1px 0px var(--center-channel-color-24), inset 4px 0px 0px var(--button-bg);
    `}
`;

const IncidentTitle = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
    margin-bottom: 6px;
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    font-size: 12px;
    line-height: 20px;
    margin: 1px 0;
`;

const Col1 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    font-weight: 600;
`;

const Col2 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 3;
    font-weight: 400;
`;

const SmallerProfile = styled(Profile)`
    >.image {
        width: 20px;
        height: 20px;
    }
`;

interface IncidentContainerProps {
    active: boolean;
}

const Button = styled.button`
    display: block;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
    margin-top: 10px;
`;

interface Props {
    incident: Incident;
    active: boolean;
    viewIncident: (incidentId: string) => void;
}

const RHSListIncident = (props: Props) => {
    const lastUpdatedMap = useSelector(lastUpdatedByIncidentId);

    return (
        <IncidentContainer active={props.active}>
            <IncidentTitle>{props.incident.name}</IncidentTitle>
            <Row>
                <Col1>{'Duration:'}</Col1>
                <Col2>
                    <Duration
                        from={props.incident.create_at}
                        to={props.incident.end_at}
                    />
                </Col2>
            </Row>
            <Row>
                <Col1>{'Status:'}</Col1>
                <Col2>
                    <div>
                        <StatusBadge status={incidentCurrentStatus(props.incident)}/>
                    </div>
                </Col2>
            </Row>
            <Row>
                <Col1>{'Last updated:'}</Col1>
                <Col2>
                    <Duration
                        from={lastUpdatedMap[props.incident.id]}
                        to={0}
                        ago={true}
                    />
                </Col2>
            </Row>
            <Row>
                <Col1>{'Commander:'}</Col1>
                <Col2>
                    <SmallerProfile userId={props.incident.commander_user_id}/>
                </Col2>
            </Row>
            <Button
                onClick={() => props.viewIncident(props.incident.channel_id)}
                data-testid='go-to-channel'
            >
                {'Go to Incident Channel'}
            </Button>
        </IncidentContainer>
    );
};

export default RHSListIncident;
