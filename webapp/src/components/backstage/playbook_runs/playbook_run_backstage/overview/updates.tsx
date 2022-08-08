// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {Team} from '@mattermost/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';
import {useIntl} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';

import {
    Content,
    EmptyBody,
    TabPageContainer,
    Title,
} from 'src/components/backstage/playbook_runs/shared';

import PostCard from 'src/components/rhs/post_card';
import {usePost} from 'src/hooks';

const StyledContent = styled(Content)`
    padding: 24px;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const Updates = (props: Props) => {
    const statusPosts = props.playbookRun.status_posts;
    const sortedStatusPosts = [...statusPosts].sort((a, b) => b.create_at - a.create_at);

    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));

    const noUpdatesText = props.playbookRun.status_update_enabled ? formatMessage({defaultMessage: 'There are no updates available.'}) : formatMessage({defaultMessage: 'Status updates were disabled for this playbook run.'});

    let updates: ReactNode = <EmptyBody id={'status-update-msg'}>{noUpdatesText}</EmptyBody>;

    if (sortedStatusPosts.length) {
        updates = sortedStatusPosts.reduce((result, sp) => {
            if (sp.delete_at === 0) {
                result.push(
                    <PostContent
                        key={sp.id}
                        postId={sp.id}
                        channelId={props.playbookRun.channel_id}
                        playbookRunId={props.playbookRun.id}
                        playbookId={props.playbookRun.playbook_id}
                        team={team}
                    />
                );
            }

            return result;
        }, [] as ReactNode[]);
    }

    return (
        <TabPageContainer data-testid='updates'>
            <Title>{formatMessage({defaultMessage: 'Updates'})}</Title>
            {updates}
        </TabPageContainer>
    );
};

type PostContentProps = {
    postId: string;
    team: Team;
    channelId: string;
    playbookId: string;
    playbookRunId: string;
}

const PostContent = (props: PostContentProps) => {
    const [post] = usePost(props.postId);

    if (!post) {
        return null;
    }

    return (
        <StyledContent>
            <PostCard
                post={post}
                team={props.team}
            />
        </StyledContent>
    );
};

export default Updates;
