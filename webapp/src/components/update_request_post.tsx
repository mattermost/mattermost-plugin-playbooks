// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {CSSProperties, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {components, ContainerProps} from 'react-select';
import {Duration} from 'luxon';

import {Post} from 'mattermost-redux/types/posts';
import {GlobalState} from 'mattermost-redux/types/store';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getPlaybookRunByTeamAndChannelId} from 'src/selectors';
import PostText from 'src/components/post_text';
import {PrimaryButton} from 'src/components/assets/buttons';
import {promptUpdateStatus} from 'src/actions';
import {resetReminder} from 'src/client';
import {CustomPostContainer} from 'src/components/custom_post_styles';
import {makeOption, Mode, ms, Option} from 'src/components/datetime_input';
import {nearest} from 'src/utils';
import {StyledSelect} from 'src/components/backstage/styles';
import {useClientRect} from 'src/hooks';
import {PlaybookRun} from 'src/types/playbook_run';
import {formatDuration} from 'src/components/formatted_duration';

interface Props {
    post: Post;
}

const optionFromSeconds = (seconds: number): Option => {
    const duration = Duration.fromObject({seconds});

    return {
        label: `for ${formatDuration(duration, 'long')}`,
        value: duration,
    };
};

export const UpdateRequestPost = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel.team_id));
    const playbookRun = useSelector<GlobalState, PlaybookRun | undefined>((state) => getPlaybookRunByTeamAndChannelId(state, team?.id, channel?.id));
    const targetUsername = props.post.props.targetUsername ?? '';

    // Decide whether to open the snooze menu above or below
    const [snoozeMenuPos, setSnoozeMenuPos] = useState('top');
    const [rect, ref] = useClientRect();
    useEffect(() => {
        if (!rect) {
            return;
        }

        setSnoozeMenuPos((rect.top < 250) ? 'bottom' : 'top');
    }, [rect]);

    if (!playbookRun) {
        return null;
    }

    const options = [
        makeOption('for 60 minutes', Mode.DurationValue),
        makeOption('for 24 hours', Mode.DurationValue),
        makeOption('for 7 days', Mode.DurationValue),
    ];
    const pushIfNotIn = (option: Option) => {
        if (!options.find((o) => ms(option.value) === ms(o.value))) {
            // option doesn't already exist
            options.push(option);
        }
    };
    if (playbookRun.previous_reminder) {
        pushIfNotIn(optionFromSeconds(nearest(playbookRun.previous_reminder * 1e-9, 1)));
    }
    if (playbookRun.reminder_timer_default_seconds) {
        pushIfNotIn(optionFromSeconds(playbookRun.reminder_timer_default_seconds));
    }
    options.sort((a, b) => ms(a.value) - ms(b.value));

    const snoozeFor = (option: Option) => {
        resetReminder(playbookRun.id, ms(option.value) / 1000);
    };

    const SelectContainer = ({children, ...ownProps}: ContainerProps<Option, boolean>) => {
        return (
            <components.SelectContainer
                {...ownProps}

                // @ts-ignore
                innerProps={{...ownProps.innerProps, role: 'button'}}
            >
                {children}
            </components.SelectContainer>
        );
    };

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{targetUsername}, please provide a status update.'}, {targetUsername})}
                team={team}
            />
            <Container ref={ref}>
                <PostUpdatePrimaryButton
                    onClick={() => {
                        dispatch(promptUpdateStatus(
                            team.id,
                            playbookRun?.id,
                            props.post.channel_id,
                        ));
                    }}
                >
                    {formatMessage({defaultMessage: 'Post update'})}
                </PostUpdatePrimaryButton>
                <SelectWrapper
                    filterOption={null}
                    isMulti={false}
                    menuPlacement={snoozeMenuPos}
                    components={{
                        IndicatorSeparator: () => null,
                        SelectContainer,
                    }}
                    placeholder={formatMessage({defaultMessage: 'Snooze'})}
                    options={options}
                    onChange={snoozeFor}
                    menuPortalTarget={document.body}
                    styles={{
                        control: (base: CSSProperties) => ({
                            ...base,
                            height: '40px',
                            minWidth: '100px',
                        }),
                        menuPortal: (base: CSSProperties) => ({
                            ...base,
                            minWidth: '168px',
                            zIndex: 22,
                        }),
                    }}
                />
            </Container>
        </>
    );
};

const PostUpdateButtonCommon = css`
    justify-content: center;
    flex: 1;
    max-width: 135px;
    margin: 4px;
`;

const SelectWrapper = styled(StyledSelect)`
    margin: 4px;
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)`
    ${PostUpdateButtonCommon} {
    }

    white-space: nowrap;
`;

const Container = styled(CustomPostContainer)`
    display: flex;
    flex-direction: row;
    padding: 12px;
    flex-wrap: wrap;
    max-width: 440px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;
