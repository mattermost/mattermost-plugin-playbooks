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
import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {useNow} from 'src/hooks';
import Clock from 'src/components/assets/icons/clock';
import Exclamation from 'src/components/assets/icons/exclamation';
import {TertiaryButton} from 'src/components/assets/buttons';
import {PAST_TIME_SPEC, FUTURE_TIME_SPEC} from 'src/components/time_spec';

interface Props {
    playbookRun: PlaybookRun;
    role: Role,
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

// TODO:
// - ask abhijit for state when overdue
const StatusUpdate = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fiveSeconds = 5000;
    const now = useNow(fiveSeconds);

    if (!props.playbookRun.status_update_enabled) {
        return null;
    }

    const isFinished = props.playbookRun.current_status === PlaybookRunStatus.Finished;
    const isNextUpdateScheduled = props.playbookRun.previous_reminder !== 0;
    const timestamp = getTimestamp(props.playbookRun, isNextUpdateScheduled);
    const isDue = isNextUpdateScheduled && timestamp < now;

    let pretext = <FormattedMessage defaultMessage='Last update'/>;

    if (isFinished) {
        pretext = <FormattedMessage defaultMessage='Run finished'/>;
    } else if (isNextUpdateScheduled) {
        pretext = (isDue ? <FormattedMessage defaultMessage='Update overdue'/> : <FormattedMessage defaultMessage='Update due'/>);
    }

    const timespec = (isDue || !isNextUpdateScheduled) ? PAST_TIME_SPEC : FUTURE_TIME_SPEC;
    let icon: JSX.Element;
    if (isDue) {
        icon = <Exclamation/>;
    } else {
        icon = <Clock className='icon-size-24'/>;
    }

    return (
        <Container>
            {props.role === Role.Viewer ? <Header>
                <AnchorLinkTitle
                    title={formatMessage({defaultMessage: 'Recent status update'})}
                    id='recent-update'
                />
            </Header> : <Content>
                <IconWrapper>{icon}</IconWrapper>
                <Text>{pretext}</Text>
                <DueDate>
                    <Timestamp
                        value={timestamp.toJSDate()}
                        units={timespec}
                        useTime={false}
                    />
                </DueDate>
                <RightWrapper>
                    <PostUpdateButton
                        onClick={() =>
                            dispatch(promptUpdateStatus(
                                props.playbookRun.team_id,
                                props.playbookRun.id,
                                props.playbookRun.channel_id,
                            ))}
                    >
                        {formatMessage({defaultMessage: 'Post update'})}
                    </PostUpdateButton>
                    <Kebab>
                        <DotMenu
                            icon={<ThreeDotsIcon/>}
                        >
                            <DropdownMenuItemStyled
                                onClick={props.onViewAllUpdates}
                            >
                                <FormattedMessage defaultMessage='View all updates'/>
                            </DropdownMenuItemStyled>
                        </DotMenu>
                    </Kebab>
                </RightWrapper>
            </Content>}
        </Container>
    );
};

export default StatusUpdate;

const Container = styled.div`
    margin: 8px 0 25px 0;
    display: flex;
    flex-direction: column;

    .icon-size-24 {
        width: 24px;
        height: 24px;
    }
`;

const Content = styled.div`
    display: flex;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 12px;
    border-radius: 4px;
    height: 56px;
    align-items: center;
`;

const Header = styled.div`
    display: flex;
    flex: 1;
`;

const IconWrapper = styled.div`
    margin-left: 4px;
    display: flex;
`;
const Text = styled.div`
    margin: 0 4px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    display: flex;
`;
const DueDate = styled.div`
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 600;
    display: flex;
`;
const Kebab = styled.div`
    margin-left: 8px;
    display: flex;
`;

const RightWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;
`;

const PostUpdateButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 32px;
`;

// TODO: hover effect and check background colors
const ThreeDotsIcon = styled(HamburgerButton)`
    font-size: 18px;
    margin-left: 4px;
`;