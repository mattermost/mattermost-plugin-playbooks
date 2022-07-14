// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {DateTime} from 'luxon';

import debounce from 'debounce';

import UpgradeRetrospectiveSvg from 'src/components/assets/upgrade_retrospective_svg';
import {Container, Content, Left, Right, Title} from 'src/components/backstage/playbook_runs/shared';
import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';

import {useAllowPlaybookAndRunMetrics, useAllowRetrospectiveAccess, usePlaybookRunViewTelemetry} from 'src/hooks';
import {PlaybookRunViewTarget} from 'src/types/telemetry';
import {PlaybookRun, RunMetricData} from 'src/types/playbook_run';
import {Metric} from 'src/types/playbook';

import {publishRetrospective, updateRetrospective} from 'src/client';
import {PAST_TIME_SPEC} from 'src/components/time_spec';

import {PrimaryButton} from 'src/components/assets/buttons';
import {Timestamp} from 'src/webapp_globals';
import ConfirmModalLight from 'src/components/widgets/confirmation_modal_light';
import MetricsData from '../metrics/metrics_data';

import Report from './report';
import TimelineRetro from './timeline_retro';

const editDebounceDelayMilliseconds = 2000;

interface Props {
    playbookRun: PlaybookRun;
    metricsConfigs?: Metric[];
    deleteTimelineEvent: (id: string) => void;
    setRetrospective: (retrospective: string) => void;
    setPublishedAt: (publishedAt: number) => void;
    setCanceled: (canceled: boolean) => void;
    setMetricsData: (metricsData: RunMetricData[]) => void;
}

export const Retrospective = (props: Props) => {
    usePlaybookRunViewTelemetry(PlaybookRunViewTarget.Retrospective, props.playbookRun.id);

    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();
    const {formatMessage} = useIntl();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [retrospectiveInfoUpdated, setUpdated] = useState(0);
    const didMountRef = useRef(false);
    const childRef = useRef<any>();
    const metricsAvailable = useAllowPlaybookAndRunMetrics();

    useEffect(() => {
        if (didMountRef.current) {
            updateRetrospective(props.playbookRun.id, props.playbookRun.retrospective, props.playbookRun.metrics_data);
        }
        didMountRef.current = true;
    }, [retrospectiveInfoUpdated]);

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

    const confirmedPublish = () => {
        publishRetrospective(props.playbookRun.id, props.playbookRun.retrospective, props.playbookRun.metrics_data);
        props.setPublishedAt(DateTime.now().valueOf());
        props.setCanceled(false);
        setShowConfirmation(false);
    };

    const publishButtonText: React.ReactNode = formatMessage({defaultMessage: 'Publish'});
    let publishComponent = (
        <PrimaryButtonSmaller
            onClick={() => {
                if (childRef.current) {
                    const valid = childRef.current.validateInputs();
                    if (!valid) {
                        return;
                    }
                }
                setShowConfirmation(true);
            }}
        >
            <TextContainer>{publishButtonText}</TextContainer>
        </PrimaryButtonSmaller>
    );

    const isPublished = props.playbookRun.retrospective_published_at > 0 && !props.playbookRun.retrospective_was_canceled;
    if (isPublished) {
        const publishedAt = (
            <Timestamp
                value={props.playbookRun.retrospective_published_at}
                useTime={false}
                units={PAST_TIME_SPEC}
            />
        );
        publishComponent = (
            <>
                <TimestampContainer>
                    <i className={'icon icon-check-all'}/>
                    <span>{''}</span>
                    {formatMessage({defaultMessage: 'Published {timestamp}'}, {timestamp: publishedAt})}
                </TimestampContainer>
                <DisabledPrimaryButtonSmaller>
                    <TextContainer>{publishButtonText}</TextContainer>
                </DisabledPrimaryButtonSmaller>
            </>
        );
    }

    const persistMetricEditEvent = (data: RunMetricData[]) => {
        props.setMetricsData(data);
        setUpdated(retrospectiveInfoUpdated + 1);
    };
    const persistReportEditEvent = (report: string) => {
        props.setRetrospective(report);
        setUpdated(retrospectiveInfoUpdated + 1);
    };

    const debouncedPersistMetricEditEvent = debounce(persistMetricEditEvent, editDebounceDelayMilliseconds);
    const debouncedPersistReportEditEvent = debounce(persistReportEditEvent, editDebounceDelayMilliseconds);

    return (
        <Container>
            <Left>
                {props.playbookRun.retrospective_enabled ? (
                    <div>
                        <Header>
                            <Title>{formatMessage({defaultMessage: 'Retrospective'})}</Title>
                            <HeaderButtonsRight>
                                {publishComponent}
                            </HeaderButtonsRight>
                        </Header>
                        <StyledContent>
                            {props.metricsConfigs && metricsAvailable &&
                                <MetricsData
                                    ref={childRef}
                                    metricsData={props.playbookRun.metrics_data}
                                    metricsConfigs={props.metricsConfigs}
                                    notEditable={isPublished}
                                    onEdit={debouncedPersistMetricEditEvent}
                                    flushChanges={() => debouncedPersistMetricEditEvent.flush()}
                                />}
                            <Report
                                playbookRun={props.playbookRun}
                                onEdit={debouncedPersistReportEditEvent}
                                flushChanges={() => debouncedPersistReportEditEvent.flush()}
                                notEditable={isPublished}
                            />
                        </StyledContent>
                    </div>
                ) : (
                    <RetrospectiveDisabledText id={'retrospective-disabled-msg'}>
                        {formatMessage({defaultMessage: 'Retrospectives were disabled for this playbook run.'})}
                    </RetrospectiveDisabledText>
                )}
            </Left>
            <Right>
                <TimelineRetro
                    playbookRun={props.playbookRun}
                    deleteTimelineEvent={props.deleteTimelineEvent}
                />
            </Right>
            <ConfirmModalLight
                show={showConfirmation}
                title={formatMessage({defaultMessage: 'Are you sure you want to publish?'})}
                message={formatMessage({defaultMessage: 'You will not be able to edit the retrospective report after publishing it. Do you want to publish the retrospective report?'})}
                confirmButtonText={formatMessage({defaultMessage: 'Publish'})}
                onConfirm={confirmedPublish}
                onCancel={() => setShowConfirmation(false)}
            />
        </Container>
    );
};

const RetrospectiveDisabledText = styled.div`
    font-weight: normal;
    font-size: 20px;
    color: var(--center-channel-color);
    text-align: left;
`;

const StyledContent = styled(Content)`
    padding: 0 24px;
`;

const PrimaryButtonSmaller = styled(PrimaryButton)`
    height: 32px;
`;

const TextContainer = styled.span`
    display: flex;
`;

const DisabledPrimaryButtonSmaller = styled(PrimaryButtonSmaller)`
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.32);
    margin-left: 16px;
    cursor: default;

    &:active:not([disabled])  {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &:hover:enabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        &:before {
            opacity: 0;
        }
    }
`;

const Header = styled.div`
    display: flex;
    align-items: center;
`;

const HeaderButtonsRight = styled.div`
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;

    > * {
        margin-left: 4px;
    }
`;

const TimestampContainer = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: normal;
    margin-right: 16px;
`;
