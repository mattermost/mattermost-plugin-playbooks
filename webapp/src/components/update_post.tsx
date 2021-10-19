import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import Icon from '@mdi/react';
import {mdiCheckAll} from '@mdi/js';

import {Post} from 'mattermost-redux/types/posts';
import {getChannel, getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {Channel} from 'mattermost-redux/types/channels';
import {GlobalState} from 'mattermost-redux/types/store';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';

import Tooltip from 'src/components/widgets/tooltip';
import PostText from 'src/components/post_text';
import {CustomPostContainer, CustomPostContent} from 'src/components/custom_post_styles';
import {messageHtmlToComponent, formatText} from 'src/webapp_globals';
import {ChannelNamesMap} from 'src/types/backstage';
import {useFormattedUsernameByID} from 'src/hooks/general';
import {currentPlaybookRun} from 'src/selectors';

interface Props {
    post: Post;
}

export const UpdatePost = (props: Props) => {
    const channel = useSelector<GlobalState, Channel>((state) => getChannel(state, props.post.channel_id));
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, channel?.team_id));
    const channelNamesMap = useSelector<GlobalState, ChannelNamesMap>(getChannelsNameMapInCurrentTeam);
    const currentRun = useSelector(currentPlaybookRun);

    const markdownOptions = {
        singleline: false,
        mentionHighlight: true,
        atMentions: true,
        team,
        channelNamesMap,
    };

    const mdText = (text: string) => messageHtmlToComponent(formatText(text, markdownOptions), true, {});

    const numTasksChecked = props.post.props.numTasksChecked ?? 0;
    const numTasks = props.post.props.numTasks ?? 0;
    const authorUsername = props.post.props.authorUsername ?? '';

    const participantIDs = props.post.props.participantIds ?? [];
    const numParticipants = participantIDs.length;
    const participantUsernames = participantIDs.map(useFormattedUsernameByID).join(', ');

    const playbookRunId = props.post.props.playbookRunId ?? '';
    const overviewURL = `/playbooks/runs/${playbookRunId}`;
    const runName = props.post.props.runName ?? '';

    // Add a link to the overview page if this post is the one in the broadcast channel
    const textSuffix = currentRun?.id === playbookRunId ? '' : ` for [${runName}](${overviewURL})`;

    return (
        <>
            <StyledPostText
                text={`@${authorUsername} posted an update${textSuffix}`}
                team={team}
            />
            <FullWidthContainer>
                <FullWidthContent>
                    <TextBody>{mdText(props.post.message)}</TextBody>
                    <Separator/>
                    <Badges>
                        <Badge tooltipText={'Tasks'}>
                            <Icon
                                path={mdiCheckAll}
                                size={1}
                            />
                            <span>
                                <b>{numTasksChecked}</b>
                                {' of '}
                                <b>{numTasks}</b>
                                {` task${numTasks === 1 ? '' : 's'} checked`}
                            </span>
                        </Badge>
                        <BadgeSeparator/>
                        <Badge tooltipText={participantUsernames}>
                            <BadgeIcon className={'icon-account-multiple-outline icon-12'}/>
                            <span>
                                <b>{numParticipants}</b>
                                {` participant${numParticipants === 1 ? '' : 's'}`}
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
    && {
        border: none;
        height: 1px;
        background: rgba(var(--center-channel-color-rgb), 0.61);
    }
`;

const Badges = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
`;

interface BadgeProps {
    tooltipText: string;
    children: React.ReactNode;
}

const Badge = (props: BadgeProps) => {
    return (
        <Tooltip
            id={'custom-status-post-badge-' + props.tooltipText}
            content={props.tooltipText}
        >
            <BadgeContainer>
                {props.children}
            </BadgeContainer>
        </Tooltip>
    );
};

const BadgeContainer = styled.div`
    margin-right: 8px;

    display: inline-flex;
    align-items: center;

    svg {
        margin-right: 4px;
    }

    font-weight: normal;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.02em;

    color: rgba(var(--center-channel-color-rgb), 0.64);

    height: 24px;
`;

const BadgeSeparator = styled(BadgeContainer)`
    font-size: 14px;
    color: rgba(var(--center-channel-color-rgb), 0.24);

    :after{
        content: '•';
    }
`;

const BadgeIcon = styled.i`
    padding-bottom: 2px;
    margin-left: -4px;
`;
