// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {GlobalState} from 'mattermost-redux/types/store';
import {Post} from 'mattermost-redux/types/posts';

import {Incident} from 'src/types/incident';
import PostCard from 'src/components/rhs/post_card';
import {Content, TabPageContainer, Title} from 'src/components/backstage/incidents/shared';

const Body = styled.div`
    margin: 10px 0 0 0;
`;

interface Props {
    incident: Incident;
}

const Updates = (props: Props) => {
    //const posts = useGetPosts(props.incident.status_posts.map((p) => p.id));
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
    const post = useSelector<GlobalState, Post>((state) => getPost(state, props.postId));

    return (
        <Content>
            <Body>
                <PostCard post={post}/>
            </Body>
        </Content>
    );
};

export default Updates;
