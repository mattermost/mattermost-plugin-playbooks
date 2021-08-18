// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useSelector} from 'react-redux';
import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

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
    const statusPosts = props.playbookRun.status_posts.sort((a, b) => b.create_at - a.create_at);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id));

    let updates: JSX.Element | JSX.Element[] =
        <EmptyBody>{'There are no updates available.'}</EmptyBody>;
    if (statusPosts.length) {
        updates = statusPosts.map((sp) => (
            <PostContent
                key={sp.id}
                postId={sp.id}
                team={team}
            />
        ));
    }

    return (
        <TabPageContainer>
            <Title>{'Updates'}</Title>
            {updates}
        </TabPageContainer>
    );
};

const PostContent = (props: { postId: string, team: Team }) => {
    const post = usePost(props.postId);

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
