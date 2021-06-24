// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

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

    let updates: JSX.Element | JSX.Element[] =
        <EmptyBody>{'There are no updates available.'}</EmptyBody>;
    if (statusPosts.length) {
        updates = statusPosts.map((sp) => (
            <PostContent
                key={sp.id}
                postId={sp.id}
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

const PostContent = (props: { postId: string }) => {
    const post = usePost(props.postId);

    if (!post) {
        return null;
    }

    return (
        <StyledContent>
            <PostCard post={post}/>
        </StyledContent>
    );
};

export default Updates;
