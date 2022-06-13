import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {FormattedMessage, useIntl} from 'react-intl';
import {DateTime} from 'luxon';

import DotMenu, {DropdownMenuItemStyled} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';

import {Role, AnchorLinkTitle} from '../shared';
import {Timestamp} from 'src/webapp_globals';
import {promptUpdateStatus} from 'src/actions';
import {PlaybookRun, PlaybookRunStatus, StatusPostComplete} from 'src/types/playbook_run';
import {useNow} from 'src/hooks';
import Clock from 'src/components/assets/icons/clock';
import {TertiaryButton} from 'src/components/assets/buttons';
import {PAST_TIME_SPEC, FUTURE_TIME_SPEC} from 'src/components/time_spec';

import StatusUpdateCard from './update_card';

interface Props {
    playbookRun: PlaybookRun;
    role: Role,
    lastStatusUpdate?: StatusPostComplete;
    onViewAllUpdates: () => void,
}

const getTimestamp = (playbookRun: PlaybookRun, isNextUpdateScheduled: boolean) => {
    let timestampValue = playbookRun.last_status_update_at;

    if (playbookRun.current_status === PlaybookRunStatus.Finished) {
        timestampValue = playbookRun.end_at;
    } else if (isNextUpdateScheduled) {
        const previousReminderMillis = Math.floor(playbookRun.previous_reminder / 1e6);
        timestampValue = playbookRun.last_status_update_at + previousReminderMillis;
    }

    return DateTime.fromMillis(timestampValue);
};

enum dueType {
    Scheduled = 'scheduled',
    Overdue = 'overdue',
    Past = 'past',
    Finished = 'finished',
}

// getDueInfo does all the computation to know the relative date and text
// that should be done related to the last/next status update
// TODO: check missing else
const getDueInfo = (playbookRun: PlaybookRun, now: DateTime) => {
    const isFinished = playbookRun.current_status === PlaybookRunStatus.Finished;
    const isNextUpdateScheduled = playbookRun.previous_reminder !== 0;
    const timestamp = getTimestamp(playbookRun, isNextUpdateScheduled);
    const isDue = isNextUpdateScheduled && timestamp < now;

    let type = dueType.Past;
    let text = <FormattedMessage defaultMessage='Last update'/>;

    if (isFinished) {
        text = <FormattedMessage defaultMessage='Run finished'/>;
        type = dueType.Finished;
    } else if (isNextUpdateScheduled) {
        type = (isDue ? dueType.Overdue : dueType.Scheduled);
        text = (isDue ? <FormattedMessage defaultMessage='Update overdue'/> : <FormattedMessage defaultMessage='Update due'/>);
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

// TODO:
// - implement request update mechanism
// - doticon hover/active statuses -> check compass
const StatusUpdate = ({playbookRun, role, onViewAllUpdates, lastStatusUpdate}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);

    if (!playbookRun.status_update_enabled) {
        return null;
    }

    const dueInfo = getDueInfo(playbookRun, now);

    const postUpdate = () => dispatch(promptUpdateStatus(
        playbookRun.team_id,
        playbookRun.id,
        playbookRun.channel_id,
    ));

    // Extract last update (only if viewer)
    const renderStatusUpdate = () => {
        if (playbookRun.status_posts.length === 0 || !lastStatusUpdate) {
            return null;
        }
        return <StatusUpdateCard post={lastStatusUpdate}/>;
    };

    if (role === Role.Viewer) {
        return (
            <Container>
                <Header>
                    <AnchorLinkTitle
                        title={formatMessage({defaultMessage: 'Recent status update'})}
                        id='recent-update'
                    />
                    <RightWrapper>
                        <IconWrapper>
                            <IconClock
                                type={dueInfo.type}
                                size={14}
                            />
                        </IconWrapper>
                        <TextDateViewer type={dueInfo.type}>{dueInfo.text}</TextDateViewer>
                        <DueDateViewer type={dueInfo.type}>{dueInfo.time}</DueDateViewer>
                        <ActionButton onClick={() => null}>
                            {formatMessage({defaultMessage: 'Request update...'})}
                        </ActionButton>
                    </RightWrapper>
                </Header>
                <Content isShort={false}>
                    {renderStatusUpdate() || <Placeholder>{formatMessage({defaultMessage: 'No updates have been posted yet'})}</Placeholder>}
                </Content>
                {playbookRun.status_posts.length ? <ViewAllUpdates onClick={onViewAllUpdates}>
                    {formatMessage({defaultMessage: 'View all updates'})}
                </ViewAllUpdates> : null}
            </Container>
        );
    }

    return (
        <Container>
            <Content isShort={true}>
                <IconWrapper>
                    <IconClock
                        type={dueInfo.type}
                        size={24}
                    />
                </IconWrapper>
                <TextDate type={dueInfo.type}>{dueInfo.text}</TextDate>
                <DueDateParticipant type={dueInfo.type}>{dueInfo.time}</DueDateParticipant>
                <RightWrapper>
                    <ActionButton onClick={postUpdate}>
                        {formatMessage({defaultMessage: 'Post update'})}
                    </ActionButton>
                    <Kebab>
                        <DotMenu icon={<ThreeDotsIcon/>}>
                            <DropdownMenuItemStyled onClick={onViewAllUpdates}>
                                <FormattedMessage defaultMessage='View all updates'/>
                            </DropdownMenuItemStyled>
                        </DotMenu>
                    </Kebab>
                </RightWrapper>
            </Content>
        </Container>
    );
};

export default StatusUpdate;

const Container = styled.div`
    margin: 8px 0 25px 0;
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
    margin-top: 20px;
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
    color: ${({type}) => (type === dueType.Overdue ? '#D24B4E' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    display: flex;
`;

const TextDateViewer = styled(TextDate)`
    font-size: 12px;
    line-height: 9.5px;
`;

const DueDateParticipant = styled.div<{type: dueType}>`
    font-size: 14px;
    line-height:20px;
    color: ${({type}) => (type === dueType.Overdue ? '#D24B4E' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    font-weight: 600;
    display: flex;
    margin-right: 5px;
`;

const IconClock = styled(Clock)<{type: dueType, size: number}>`
    color: ${({type}) => (type === dueType.Overdue ? '#D24B4E' : 'rgba(var(--center-channel-color-rgb), 0.72)')};
    height: ${({size}) => size}px;
    width: ${({size}) => size}px;
`;

const DueDateViewer = styled(DueDateParticipant)`
    font-size: 12px;
    line-height: 9.5px;
    margin-right: 10px;

`;
const Kebab = styled.div`
    margin-left: 8px;
    display: flex;
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
`;

// TODO: hover effect and check background colors
const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 4px;
`;

