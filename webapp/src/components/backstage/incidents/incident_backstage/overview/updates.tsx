// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {Incident} from 'src/types/incident';
import PostCard from 'src/components/rhs/post_card';
import {Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';
import {usePost} from 'src/hooks';

const Body = styled.div`
    margin: 10px 0 0 0;
`;

interface Props {
    incident: Incident;
}

const Updates = (props: Props) => {
    const statusPosts = props.incident.status_posts.sort((a, b) => b.create_at - a.create_at);

    return (
        <TabPageContainer>
            <Title>{'Updates'}</Title>
            {statusPosts?.map((sp) => (
                <PostContent
                    key={sp.id}
                    postId={sp.id}
                />
            ))}
        </TabPageContainer>
    );
};

const PostContent = (props: { postId: string }) => {
    const post = usePost(props.postId);

    if (!post) {
        return null;
    }

    return (
        <Content>
            <Body>
                <PostCard post={post}/>
            </Body>
        </Content>
    );
};

export default Updates;
