// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {Metric, MetricType} from 'src/types/playbook';
import {targetToString} from 'src/components/backstage/playbook_edit/metrics/shared';

interface Props {
    metric: Metric;
    editClick: () => void;
}

const MetricView = ({metric, editClick}: Props) => {
    const {formatMessage} = useIntl();
    const noTarget = formatMessage({defaultMessage: ': No target set.'});
    const noDescription = formatMessage({defaultMessage: 'No description.'});
    const perRun = formatMessage({defaultMessage: 'per run'});

    let icon = <i className='icon-currency-usd'/>;
    if (metric.type === MetricType.Integer) {
        icon = <i className='icon-pound'/>;
    } else if (metric.type === MetricType.Duration) {
        icon = <i className='icon-clock-outline'/>;
    }

    const targetStr = targetToString(metric.target, metric.type);
    const target = metric.target ? <>{': '}<TargetText>{icon}{`${targetStr} ${perRun}`}</TargetText></> : noTarget;

    return (
        <ViewContainer>
            <Lhs>{icon}</Lhs>
            <Centre>
                <Title>{metric.title}</Title>
                <Detail>
                    <Bold>{formatMessage({defaultMessage: 'Target'})}</Bold>
                    {target}
                </Detail>
                <Detail>
                    <Bold>{formatMessage({defaultMessage: 'Description'})}</Bold>
                    {`: ${metric.description || noDescription}`}
                </Detail>
            </Centre>
            <Rhs>
                <Button
                    data-testid={'edit-metric'}
                    onClick={editClick}
                >
                    <i className='icon-pencil-outline'/>
                </Button>
            </Rhs>
        </ViewContainer>
    );
};

const ViewContainer = styled.div`
    display: flex;
    font-size: 14px;
    line-height: 20px;
    padding: 12px 16px 16px;
    margin-bottom: 12px;
    color: var(--center-channel-color);
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const Lhs = styled.div`
    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    padding: 0 6px 0 0;

    > i {
        margin-top: 2px;
    }
`;

const Centre = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Detail = styled.div`
    margin-top: 4px;
`;

const TargetText = styled.span`
    padding-left: 20px;
    position: relative;

    > i {
        position: absolute;
        left: 0;
    }
`;

const Title = styled.div`
    font-weight: 600;
    color: var(--center-channel-color);
`;

const Bold = styled.span`
    font-weight: 600;
`;

const Rhs = styled.div`
    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Button = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    padding: 4px 1px;
    background: none;
    border-radius: 4px;
    border: 0;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export default MetricView;
