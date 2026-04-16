// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import styled from 'styled-components';

import {Post} from '@mattermost/types/posts';
import {getChannel, getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {General} from 'mattermost-redux/constants';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {useAppSelector} from 'src/hooks/redux';

import PostText from 'src/components/post_text';
import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {formatText, messageHtmlToComponent} from 'src/webapp_globals';
import {useFormattedUsernameByID} from 'src/hooks/general';

interface Props {
    post: Post;
}

export const UpdatePost = (props: Props) => {
    const {formatMessage} = useIntl();
    const channel = useAppSelector((state) => getChannel(state, props.post.channel_id));
    const currentTeamId = useAppSelector(getCurrentTeamId);
    const teamId = channel?.type === General.DM_CHANNEL || channel?.type === General.GM_CHANNEL ? currentTeamId : channel?.team_id;
    const team = useAppSelector((state) => getTeam(state, teamId ?? ''));
    const channelNamesMap = useAppSelector(getChannelsNameMapInCurrentTeam);

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const messageHtmlToComponentOptions = {
        hasPluginTooltips: true,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, messageHtmlToComponentOptions);

    const numTasksChecked = typeof props.post.props.numTasksChecked === 'number' ? props.post.props.numTasksChecked : 0;
    const numTasks = typeof props.post.props.numTasks === 'number' ? props.post.props.numTasks : 0;
    const authorUsername = typeof props.post.props.authorUsername === 'string' ? props.post.props.authorUsername : '';

    const participantIDs = props.post.props.participantIds && Array.isArray(props.post.props.participantIds) ? props.post.props.participantIds : [];
    const numParticipants = participantIDs.length;
    const participantUsernames = participantIDs.map(useFormattedUsernameByID).join(', ');

    const playbookRunId = props.post.props.playbookRunId ?? '';
    const overviewURL = `/playbooks/runs/${playbookRunId}`;
    const runName = typeof props.post.props.runName === 'string' ? props.post.props.runName : '';

    if (!team) {
        return null;
    }

    return (
        <>
            <StyledPostText
                text={formatMessage({defaultMessage: '@{authorUsername} posted an update for [{runName}]({overviewURL})'}, {
                    runName,
                    overviewURL,
                    authorUsername,
                })}
                team={team}
            />
            <FullWidthContainer>
                <FullWidthContent>
                    <TextBody>{mdText(props.post.message)}</TextBody>
                    <Separator/>
                    <Badges>
                        <Badge tooltipText={formatMessage({defaultMessage: 'Tasks'})}>
                            <BadgeIcon className={'icon-check-all icon-12'}/>
                            <span>
                                <FormattedMessage
                                    defaultMessage='<b>{numTasksChecked, number}</b> of <b>{numTasks, number}</b> {numTasks, plural, =1 {task} other {tasks}} checked'
                                    values={{
                                        b: (x) => <b>{x}</b>,
                                        numTasksChecked,
                                        numTasks,
                                    }}
                                />
                            </span>
                        </Badge>
                        <BadgeSeparator/>
                        <Badge tooltipText={participantUsernames}>
                            <BadgeIcon className={'icon-account-multiple-outline icon-12'}/>
                            <span>
                                <FormattedMessage
                                    defaultMessage='{numParticipants, plural, =1 {<b>#</b> participant} other {<b>#</b> participants}}'
                                    values={{
                                        b: (x) => <b>{x}</b>,
                                        numParticipants,
                                    }}
                                />
                            </span>
                        </Badge>
                    </Badges>
                </FullWidthContent>
            </FullWidthContainer>
        </>
    );
};

const FullWidthContainer = styled(CustomPostContainer)`
    max-width: 100%;
`;

const FullWidthContent = styled(CustomPostContent)`
    width: 100%;
`;

const TextBody = styled.div`
    width: 100%;
    margin-top: 4px;
    margin-bottom: 4px;
`;

const StyledPostText = styled(PostText)`
    margin-bottom: 8px;
`;

const Separator = styled.hr`
    &&& {
        height: 1px;
        border: none;
        margin: 12px 0;
        background: rgba(var(--center-channel-color-rgb), 0.16);
        opacity: 1;
    }
`;

const Badges = styled.div`
    display: flex;
    flex-flow: row wrap;
`;

interface BadgeProps {
    tooltipText: string;
    children: React.ReactNode;
}

const Badge = (props: BadgeProps) => {
    return (
        <WithTooltip
            id={'custom-status-post-badge-' + props.tooltipText}
            title={props.tooltipText}
        >
            <BadgeContainer>
                {props.children}
            </BadgeContainer>
        </WithTooltip>
    );
};

const BadgeContainer = styled.div`
    display: inline-flex;
    height: 24px;
    align-items: center;
    margin-right: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    font-size: 11px;
    font-weight: normal;
    letter-spacing: 0.02em;
    line-height: 16px;

    svg {
        margin-right: 4px;
    }
`;

const BadgeSeparator = styled(BadgeContainer)`
    color: rgba(var(--center-channel-color-rgb), 0.24);
    font-size: 14px;

    ::after{
        content: '•';
    }
`;

const BadgeIcon = styled.i`
    padding-bottom: 2px;
    margin-left: -4px;
`;
