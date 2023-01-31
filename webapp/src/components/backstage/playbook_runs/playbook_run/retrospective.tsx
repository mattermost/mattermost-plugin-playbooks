import React, {useMemo, useRef, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import debounce from 'debounce';

import {useMutation} from '@apollo/client';

import {PlaybookWithChecklist} from 'src/types/playbook';
import {publishRetrospective} from 'src/client';
import {useAllowPlaybookAndRunMetrics, useAllowRetrospectiveAccess} from 'src/hooks';
import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';
import {Timestamp} from 'src/webapp_globals';
import {AnchorLinkTitle, Content, Role} from 'src/components/backstage/playbook_runs/shared';
import MetricsData from 'src/components/backstage/playbook_runs/playbook_run/metrics/metrics_data';
import Report from 'src/components/backstage/playbook_runs/playbook_run/retrospective/report';
import ConfirmModalLight from 'src/components/widgets/confirmation_modal_light';
import {TertiaryButton} from 'src/components/assets/buttons';
import {PAST_TIME_SPEC} from 'src/components/time_spec';
import {FragmentType, getFragmentData, graphql} from 'src/graphql/generated';
import {MetricValue} from 'src/graphql/generated/graphql';

const RetrospectiveRun = graphql(/* GraphQL */`
    fragment RetrospectiveRun on Run {
        id
        teamID
        retrospective
        retrospectiveEnabled
        retrospectivePublishedAt
        retrospectiveWasCanceled
        metrics {
            metricConfigID
            value
        }
    }
`);

const UpdateRetrospective = graphql(/* GraphQL */`
    mutation UpdateRetrospective($runID: String!, $updatedText: String!, $metrics: [MetricValueUpdate!]!) {
        updateRetrospective(runID: $runID, updatedText: $updatedText, metrics: $metrics)
    }
`);

interface Props {
    id: string;
    runFragment: FragmentType<typeof RetrospectiveRun>;
    playbook: PlaybookWithChecklist | null;
    role: Role;
    focusMetricId?: string;
}

const DEBOUNCE_2_SECS = 2000;

const Retrospective = ({
    id,
    runFragment,
    playbook,
    role,
    focusMetricId,
}: Props) => {
    const playbookRun = getFragmentData(RetrospectiveRun, runFragment);
    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();
    const {formatMessage} = useIntl();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const childRef = useRef<any>();
    const metricsAvailable = useAllowPlaybookAndRunMetrics();
    const [updateRetrospective] = useMutation(UpdateRetrospective);

    const onMetricsChange = useMemo(
        () => debounce((metrics_data: MetricValue[]) => {
            updateRetrospective({variables: {
                runID: playbookRun.id,
                updatedText: playbookRun.retrospective,
                metrics: metrics_data,
            }});
        }, DEBOUNCE_2_SECS),
        [playbookRun.id, playbookRun.retrospective],
    );
    const onReportChange = useMemo(
        () => debounce((retrospective: string) => {
            updateRetrospective({variables: {
                runID: playbookRun.id,
                updatedText: retrospective,
                metrics: playbookRun.metrics,
            }});
        }, DEBOUNCE_2_SECS),
        [playbookRun.id, playbookRun.metrics],
    );

    if (!playbookRun.retrospectiveEnabled) {
        return null;
    }

    if (!allowRetrospectiveAccess) {
        return (
            <Container
                id={id}
                data-testid={'run-retrospective-section'}
            >
                <AnchorLinkTitle
                    title={formatMessage({defaultMessage: 'Retrospective'})}
                    id={id}
                />
                <BannerWrapper>
                    <UpgradeBanner
                        background={<></>}
                        titleText={formatMessage({defaultMessage: 'Publish retrospective report and access the timeline'})}
                        helpText={formatMessage({defaultMessage: 'Celebrate success and learn from mistakes with retrospective reports. Filter timeline events for process review, stakeholder engagement, and auditing purposes.'})}
                        notificationType={AdminNotificationType.RETROSPECTIVE}
                        verticalAdjustment={0}
                        vertical={true}
                    />
                </BannerWrapper>
            </Container>
        );
    }

    const onConfirmPublish = () => {
        publishRetrospective(playbookRun.id, playbookRun.retrospective, playbookRun.metrics);
        setShowConfirmation(false);
    };

    const onPublishClick = () => {
        if (childRef.current) {
            const valid = childRef.current.validateInputs();
            if (!valid) {
                return;
            }
        }
        setShowConfirmation(true);
    };

    const isPublished = playbookRun.retrospectivePublishedAt > 0 && !playbookRun.retrospectiveWasCanceled;
    const notEditable = isPublished || role === Role.Viewer;

    const renderPublishComponent = () => {
        const publishedAt = (
            <Timestamp
                value={playbookRun.retrospectivePublishedAt}
                {...PAST_TIME_SPEC}
            />
        );

        return (
            <>
                {
                    isPublished &&
                    <TimestampContainer>
                        <i className={'icon icon-check-all'}/>
                        {formatMessage({defaultMessage: 'Published {timestamp}'}, {timestamp: publishedAt})}
                    </TimestampContainer>
                }
                <PublishButton
                    onClick={onPublishClick}
                    disabled={isPublished}
                >
                    {formatMessage({defaultMessage: 'Publish'})}
                </PublishButton>
            </>
        );
    };

    return (
        <Container
            id={id}
            data-testid={'run-retrospective-section'}
        >
            <div>
                <Header>
                    <AnchorLinkTitle
                        title={formatMessage({defaultMessage: 'Retrospective'})}
                        id={id}
                    />
                    {role === Role.Participant ? (
                        <HeaderButtonsRight>
                            {renderPublishComponent()}
                        </HeaderButtonsRight>
                    ) : null}
                </Header>
                <StyledContent>
                    {playbook?.metrics && metricsAvailable &&
                        <MetricsData
                            idPrefix={id}
                            ref={childRef}
                            metricsData={playbookRun.metrics}
                            metricsConfigs={playbook.metrics}
                            notEditable={notEditable}
                            onEdit={onMetricsChange}
                            flushChanges={() => onMetricsChange.flush()}
                            focusMetricId={focusMetricId}
                        />}
                    <Report
                        teamID={playbookRun.teamID}
                        retrospective={playbookRun.retrospective}
                        onEdit={onReportChange}
                        flushChanges={() => onReportChange.flush()}
                        notEditable={notEditable}
                    />
                </StyledContent>
            </div>
            <ConfirmModalLight
                show={showConfirmation}
                title={formatMessage({defaultMessage: 'Are you sure you want to publish?'})}
                message={formatMessage({defaultMessage: 'You will not be able to edit the retrospective report after publishing it. Do you want to publish the retrospective report?'})}
                confirmButtonText={formatMessage({defaultMessage: 'Publish'})}
                onConfirm={onConfirmPublish}
                onCancel={() => setShowConfirmation(false)}
            />
        </Container>
    );
};

export default Retrospective;

const StyledContent = styled(Content)`
    padding: 0 24px;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    padding-right: 12px;
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

const Container = styled.div`
    margin-top: 20px;
    display: flex;
    flex-direction: column;
`;

const BannerWrapper = styled.div`
    display: flex;
    flex-direction: column;

    padding: 30px 0;
    margin-top: 8px;
    box-shadow: rgb(0 0 0 / 5%) 0px 0px 0px 1px;
`;

const PublishButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 16px;
`;
