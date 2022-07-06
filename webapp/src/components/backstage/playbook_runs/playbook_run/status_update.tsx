// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {DateTime} from 'luxon';

import {getTimestamp} from 'src/components/rhs/rhs_post_update';
import {AnchorLinkTitle} from 'src/components/backstage/playbook_runs/shared';
import {Timestamp} from 'src/webapp_globals';
import {openUpdateRunStatusModal} from 'src/actions';
import {PlaybookRun, PlaybookRunStatus, StatusPostComplete} from 'src/types/playbook_run';
import {useNow} from 'src/hooks';
import Clock from 'src/components/assets/icons/clock';
import {TertiaryButton} from 'src/components/assets/buttons';
import {PAST_TIME_SPEC, FUTURE_TIME_SPEC} from 'src/components/time_spec';
import {requestUpdate} from 'src/client';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {ToastType, useToasts} from '../../toast_banner';

import StatusUpdateCard from './update_card';
import {RHSContent} from './rhs';

enum dueType {
    Scheduled = 'scheduled',
    Overdue = 'overdue',
    Past = 'past',
    Finished = 'finished',
}

// getDueInfo does all the computation to know the relative date and text
// that should be done related to the last/next status update
const getDueInfo = (playbookRun: PlaybookRun, now: DateTime) => {
    const isFinished = playbookRun.current_status === PlaybookRunStatus.Finished;
    const isNextUpdateScheduled = playbookRun.previous_reminder !== 0;
    const timestamp = getTimestamp(playbookRun, isNextUpdateScheduled);
    const isDue = isNextUpdateScheduled && timestamp < now;

    let type: dueType;
    let text: React.ReactNode;

    if (isFinished) {
        text = <FormattedMessage defaultMessage='Run finished'/>;
        type = dueType.Finished;
    } else if (isNextUpdateScheduled) {
        type = (isDue ? dueType.Overdue : dueType.Scheduled);
        text = (isDue ? <FormattedMessage defaultMessage='Update overdue'/> : <FormattedMessage defaultMessage='Update due'/>);
    } else {
        type = dueType.Past;
        text = <FormattedMessage defaultMessage='Last update'/>;
    }

    const timespec = (isDue || !isNextUpdateScheduled) ? PAST_TIME_SPEC : FUTURE_TIME_SPEC;
    const time = (
        <Timestamp
            value={timestamp.toJSDate()}
            units={timespec}
            useTime={false}
        />
    );
    return {time, text, type};
};

const RHSTitle = <FormattedMessage defaultMessage={'Status updates'}/>;
const openRHSText = <FormattedMessage defaultMessage={'View all updates'}/>;
interface ViewerProps {
    id: string;
    playbookRun: PlaybookRun;
    lastStatusUpdate?: StatusPostComplete;
    openRHS: (section: RHSContent, title: React.ReactNode, subtitle?: React.ReactNode) => void;
}

export const ViewerStatusUpdate = ({id, playbookRun, openRHS, lastStatusUpdate}: ViewerProps) => {
    const {formatMessage} = useIntl();
    const addToast = useToasts().add;
    const [showRequestUpdateConfirm, setShowRequestUpdateConfirm] = useState(false);
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);

    if (!playbookRun.status_update_enabled) {
        return null;
    }

    if (playbookRun.status_posts.length === 0 && playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    const dueInfo = getDueInfo(playbookRun, now);

    const renderStatusUpdate = () => {
        if (playbookRun.status_posts.length === 0 || !lastStatusUpdate) {
            return null;
        }
        return <StatusUpdateCard post={lastStatusUpdate}/>;
    };

    const requestStatusUpdate = async () => {
        const response = await requestUpdate(playbookRun.id);
        if (response?.error) {
            addToast(formatMessage({defaultMessage: 'It was not possible to request an update'}), ToastType.Failure);
        } else {
            addToast(formatMessage({defaultMessage: 'A message was sent to the run channel.'}), ToastType.Success);
        }
    };

    return (
        <Container
            id={id}
            data-testid={'run-statusupdate-section'}
        >
            <Header>
                <AnchorLinkTitle
                    title={formatMessage({defaultMessage: 'Recent status update'})}
                    id={id}
                />
                <RightWrapper>
                    <IconWrapper>
                        <IconClock
                            type={dueInfo.type}
                            size={14}
                        />
                    </IconWrapper>
                    <TextDateViewer
                        data-testid={'update-due-date-text'}
                        type={dueInfo.type}
                    >
                        {dueInfo.text}
                    </TextDateViewer>
                    <DueDateViewer
                        data-testid={'update-due-date-time'}
                        type={dueInfo.type}
                    >
                        {dueInfo.time}
                    </DueDateViewer>
                    {playbookRun.current_status === PlaybookRunStatus.InProgress ? (
                        <ActionButton
                            data-testid={'request-update-button'}
                            onClick={() => setShowRequestUpdateConfirm(true)}
                        >
                            {formatMessage({defaultMessage: 'Request update...'})}
                        </ActionButton>
                    ) : null}
                </RightWrapper>
            </Header>
            <Content isShort={false}>
                {renderStatusUpdate() || <Placeholder>{formatMessage({defaultMessage: 'No updates have been posted yet'})}</Placeholder>}
            </Content>
            {playbookRun.status_posts.length ? <ViewAllUpdates onClick={() => openRHS(RHSContent.RunStatusUpdates, formatMessage({defaultMessage: 'Status updates'}), playbookRun.name)}>
                {openRHSText}
            </ViewAllUpdates> : null}
            <ConfirmModal
                show={showRequestUpdateConfirm}
                title={formatMessage({defaultMessage: 'Confirm request update'})}
                message={formatMessage({defaultMessage: 'A message will be sent to the run channel, requesting them to post an update.'})}
                confirmButtonText={formatMessage({defaultMessage: 'Request update'})}
                onConfirm={() => {
                    requestStatusUpdate();
                    setShowRequestUpdateConfirm(false);
                }}
                onCancel={() => setShowRequestUpdateConfirm(false)}
            />
        </Container>
    );
};

interface ParticipantProps {
    id: string;
    playbookRun: PlaybookRun;
    openRHS: (section: RHSContent, title: React.ReactNode, subtitle?: React.ReactNode) => void;
}

export const ParticipantStatusUpdate = ({id, playbookRun, openRHS}: ParticipantProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);

    if (!playbookRun.status_update_enabled) {
        return null;
    }

    const dueInfo = getDueInfo(playbookRun, now);

    // We assume that user permissions have been checked before
    const postUpdate = () => dispatch(openUpdateRunStatusModal(playbookRun.id, playbookRun.channel_id, true));

    const onClickViewAllUpdates = () => {
        if (playbookRun.status_posts.length === 0) {
            return;
        }
        openRHS(RHSContent.RunStatusUpdates, RHSTitle, playbookRun.name);
    };

    return (
        <Container
            id={id}
            data-testid={'run-statusupdate-section'}
        >
            <Content isShort={true}>
                <IconWrapper>
                    <IconClock
                        type={dueInfo.type}
                        size={24}
                    />
                </IconWrapper>
                <TextDate
                    data-testid={'update-due-date-text'}
                    type={dueInfo.type}
                >{dueInfo.text}</TextDate>
                <DueDateParticipant
                    data-testid={'update-due-date-time'}
                    type={dueInfo.type}
                >{dueInfo.time}</DueDateParticipant>
                <RightWrapper>
                    {playbookRun.current_status === PlaybookRunStatus.InProgress ? (
                        <ActionButton
                            data-testid={'post-update-button'}
                            onClick={postUpdate}
                        >
                            {formatMessage({defaultMessage: 'Post update'})}
                        </ActionButton>
                    ) : null}
                </RightWrapper>
            </Content>
            {playbookRun.status_posts.length ? <ViewAllUpdates onClick={onClickViewAllUpdates}>
                {formatMessage({defaultMessage: 'View all updates'})}
            </ViewAllUpdates> : null}
        </Container>
    );
};

const Container = styled.div`
    margin: 8px 0 16px 0;
    display: flex;
    flex-direction: column;
`;

const Content = styled.div<{isShort: boolean}>`
    display: flex;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 12px;
    border-radius: 4px;
    height: ${({isShort}) => (isShort ? '56px' : 'auto')};
    align-items: center;
`;

const Header = styled.div`
    margin-top: 16px;
    margin-bottom: 4px;
    display: flex;
    flex: 1;
    align-items: center;
`;

const Placeholder = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.64);
`;

const IconWrapper = styled.div`
    margin-left: 4px;
    display: flex;
`;

const TextDate = styled.div<{type: dueType}>`
    margin: 0 4px;
    font-size: 14px;
    line-height: 20px;
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    display: flex;
`;

const TextDateViewer = styled(TextDate)`
    font-size: 12px;
    line-height: 9.5px;
`;

const DueDateParticipant = styled.div<{type: dueType}>`
    font-size: 14px;
    line-height:20px;
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    font-weight: 600;
    display: flex;
    margin-right: 5px;
`;

const IconClock = styled(Clock)<{type: dueType, size: number}>`
    color: ${({type}) => (type === dueType.Overdue ? 'var(--dnd-indicator)' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    height: ${({size}) => size}px;
    width: ${({size}) => size}px;
`;

const DueDateViewer = styled(DueDateParticipant)`
    font-size: 12px;
    line-height: 9.5px;
    margin-right: 10px;

`;

const RightWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex: 1;
`;

const ActionButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 16px;
`;

const ViewAllUpdates = styled.div`
    margin-top: 9px;
    font-size: 11px;
    cursor: pointer;
    color: var(--button-bg);
    font-weight: 600;
`;

