// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mdiCurrencyUsd, mdiPound} from '@mdi/js';

import Icon from '@mdi/react';

import styled, {css} from 'styled-components';

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {BaseInput} from 'src/components/assets/inputs';

import UpgradeRetrospectiveSvg from 'src/components/assets/upgrade_retrospective_svg';
import {Container, Left, Right, VerticalSpacer} from 'src/components/backstage/playbook_runs/shared';
import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';

import {useAllowRetrospectiveAccess} from 'src/hooks';
import {PlaybookRun} from 'src/types/playbook_run';

import Report from './report';

import TimelineRetro from './timeline_retro';

interface Props {
    playbookRun: PlaybookRun;
    deleteTimelineEvent: (id: string) => void;
    setRetrospective: (retrospective: string) => void;
    setPublishedAt: (publishedAt: number) => void;
    setCanceled: (canceled: boolean) => void;
}

const Title = styled.div`
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const InputWithIcon = styled.span`
    position: relative;

    i, svg {
        position: absolute;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }

    i {
        left: 10px;
        top: 0;
    }

    svg {
        left: 14px;
        top: 2px;
    }

    input {
        padding-left: 36px;
    }
`;

const StyledInput = styled(BaseInput)<{ error?: boolean }>`
    height: 32px;
    width: 100%;

    ${(props) => (
        props.error && css`
            box-shadow: inset 0 0 0 1px var(--error-text);

            &:focus {
                box-shadow: inset 0 0 0 2px var(--error-text);
            }
        `
    )}
`;
const Bold = styled.span`
    font-weight: 600;

    > svg {
        position: relative;
        top: 3px;
    }
`;

interface Metric {
    val: string;
    id: string;
}

export const Retrospective = (props: Props) => {
    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();
    const metrics = [1, 2, 3];
    const metricsValues = [{val: '9', id: '1'}, {val: '92', id: '2'}, {val: '19', id: '3'}];
    const {formatMessage} = useIntl();
    const [targetError, setTargetError] = useState('');
    const [curState, setCurState] = useState<Metric[]>(metricsValues);

    function updateMetrics(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const newList = [...curState];
        newList[index].val = event.target.value;
        setCurState(newList);
        setTargetError('');
    }

    if (!allowRetrospectiveAccess) {
        return (
            <UpgradeBanner
                background={<UpgradeRetrospectiveSvg/>}
                titleText={formatMessage({defaultMessage: 'Publish retrospective report and access the timeline'})}
                helpText={formatMessage({defaultMessage: 'Celebrate success and learn from mistakes with retrospective reports. Filter timeline events for process review, stakeholder engagement, and auditing purposes.'})}
                notificationType={AdminNotificationType.RETROSPECTIVE}
                verticalAdjustment={650}
            />
        );
    }

    return (
        <Container>
            <Left>
                {
                    metrics.map((metric, idx) => {
                        let typeTitle = ' Dollars';
                        let searchIcon = <DollarSign size={1}/>;
                        if (metric === 1) {
                            typeTitle = ' Integer';
                            searchIcon = <PoundSign size={1}/>;
                        } else if (metric === 2) {
                            typeTitle = 'Duration (in dd:hh:mm)';
                            searchIcon = <i className='icon-clock-outline'/>;
                        }

                        return (
                            <>
                                <VerticalSpacer size={16}/>
                                <Title>{'Target per run'}</Title>
                                <InputWithIcon>
                                    {searchIcon}
                                    <StyledInput
                                        placeholder={typeTitle}
                                        type='text'
                                        value={curState[idx].val}
                                        onChange={(e) => updateMetrics(idx, e)}
                                    />
                                </InputWithIcon>
                                {
                                    targetError !== '' &&
                                    <ErrorText>{targetError}</ErrorText>
                                }
                                <HelpText>{formatMessage({defaultMessage: 'We’ll show you how close or far from the target each run’s value is and also plot it on a chart.'})}</HelpText>
                            </>
                        );
                    })
                }

                {props.playbookRun.retrospective_enabled ?
                    <Report
                        playbookRun={props.playbookRun}
                        setRetrospective={props.setRetrospective}
                        setPublishedAt={props.setPublishedAt}
                        setCanceled={props.setCanceled}
                    /> :
                    <RetrospectiveDisabledText id={'retrospective-disabled-msg'}>
                        {formatMessage({defaultMessage: 'Retrospectives were disabled for this playbook run.'})}
                    </RetrospectiveDisabledText>}
            </Left>
            <Right>
                <TimelineRetro
                    playbookRun={props.playbookRun}
                    deleteTimelineEvent={props.deleteTimelineEvent}
                />
            </Right>
        </Container>
    );
};

const RetrospectiveDisabledText = styled.div`
    font-weight: normal;
    font-size: 20px;
    color: var(--center-channel-color);
    text-align: left;
`;

/*

    let typeTitle = <Bold><DollarSign size={1.2}/>{' Dollars'}</Bold>;
     let searchIcon = <DollarSign size={1}/>;
     if (metric.type === MetricType.Integer) {
         typeTitle = <Bold><PoundSign size={1.2}/>{' Integer'}</Bold>;
         searchIcon = <PoundSign size={1}/>;
     } else if (metric.type === MetricType.Duration) {
         typeTitle = <Bold><i className='icon-clock-outline'/>{' Duration (in dd:hh:mm)'}</Bold>;
         searchIcon = <i className='icon-clock-outline'/>;
     }
*/

const DollarSign = ({size}: {size: number}) => (
    <Icon
        path={mdiCurrencyUsd}
        size={size}
    />
);

const PoundSign = ({size}: {size: number}) => (
    <Icon
        path={mdiPound}
        size={size}
    />
);

const HelpText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const ErrorText = styled.div`
    font-size: 12px;
    line-height: 16px;
    margin-top: 4px;
    color: var(--error-text);
`;