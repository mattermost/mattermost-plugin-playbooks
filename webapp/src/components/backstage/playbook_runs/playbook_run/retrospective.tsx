import React, {useRef, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {DateTime} from 'luxon';
import debounce from 'debounce';

import {PlaybookRun, RunMetricData} from 'src/types/playbook_run';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {publishRetrospective, updateRetrospective} from 'src/client';
import {useAllowPlaybookAndRunMetrics, useAllowRetrospectiveAccess} from 'src/hooks';
import UpgradeBanner from 'src/components/upgrade_banner';
import {AdminNotificationType} from 'src/constants';
import {Timestamp} from 'src/webapp_globals';
import {AnchorLinkTitle, Content, Role} from 'src/components/backstage/playbook_runs/shared';
import MetricsData from '../playbook_run_backstage/metrics/metrics_data';
import Report from '../playbook_run_backstage/retrospective/report';
import ConfirmModalLight from 'src/components/widgets/confirmation_modal_light';
import {TertiaryButton} from 'src/components/assets/buttons';
import {PAST_TIME_SPEC} from 'src/components/time_spec';

interface Props {
    playbookRun: PlaybookRun;
    playbook: PlaybookWithChecklist | null;
    onChange: (playbookRun: PlaybookRun) => void;
    role: Role;
}

const DEBOUNCE_2_SECS = 2000;

const Retrospective = ({
    playbookRun,
    playbook,
    onChange,
    role,
}: Props) => {
    const allowRetrospectiveAccess = useAllowRetrospectiveAccess();
    const {formatMessage} = useIntl();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const childRef = useRef<any>();
    const metricsAvailable = useAllowPlaybookAndRunMetrics();

    if (!playbookRun.retrospective_enabled) {
        return null;
    }

    if (!allowRetrospectiveAccess) {
        return (
            <Container>
                <AnchorLinkTitle
                    title={formatMessage({defaultMessage: 'Retrospective'})}
                    id='retrospective'
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
        publishRetrospective(playbookRun.id, playbookRun.retrospective, playbookRun.metrics_data);
        onChange({
            ...playbookRun,
            retrospective_published_at: DateTime.now().valueOf(),
            retrospective_was_canceled: false,
        });
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

    const isPublished = playbookRun.retrospective_published_at > 0 && !playbookRun.retrospective_was_canceled;
    const notEditable = isPublished || role === Role.Viewer;

    const renderPublishComponent = () => {
        const publishedAt = (
            <Timestamp
                value={playbookRun.retrospective_published_at}
                {...PAST_TIME_SPEC}
            />
        );

        return (
            <>
                {
                    isPublished &&
                    <TimestampContainer>
                        <i className={'icon icon-check-all'}/>
                        <span>{''}</span>
                        {formatMessage({defaultMessage: 'Published {timestamp}'}, {timestamp: publishedAt})}
                    </TimestampContainer>
                }
                <PublishButton
                    onClick={onPublishClick}
                    disabled={notEditable}
                >
                    {formatMessage({defaultMessage: 'Publish'})}
                </PublishButton>
            </>
        );
    };

    const onMetricsChange = debounce((metrics_data: RunMetricData[]) => {
        onChange({
            ...playbookRun,
            metrics_data,
        });
        updateRetrospective(playbookRun.id, playbookRun.retrospective, metrics_data);
    }, DEBOUNCE_2_SECS);
    const onReportChange = debounce((retrospective: string) => {
        onChange({
            ...playbookRun,
            retrospective,
        });
        updateRetrospective(playbookRun.id, retrospective, playbookRun.metrics_data);
    }, DEBOUNCE_2_SECS);

    return (
        <Container>
            <div>
                <Header>
                    <AnchorLinkTitle
                        title={formatMessage({defaultMessage: 'Retrospective'})}
                        id='retrospective'
                    />
                    <HeaderButtonsRight>
                        {renderPublishComponent()}
                    </HeaderButtonsRight>
                </Header>
                <StyledContent>
                    {playbook?.metrics && metricsAvailable &&
                        <MetricsData
                            ref={childRef}
                            metricsData={playbookRun.metrics_data}
                            metricsConfigs={playbook.metrics}
                            notEditable={notEditable}
                            onEdit={onMetricsChange}
                            flushChanges={() => onMetricsChange.flush()}
                        />}
                    <Report
                        playbookRun={playbookRun}
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

const RetrospectiveDisabledText = styled.div`
    font-weight: normal;
    font-size: 20px;
    color: var(--center-channel-color);
    text-align: left;
`;

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
    margin-top: 24px;
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
