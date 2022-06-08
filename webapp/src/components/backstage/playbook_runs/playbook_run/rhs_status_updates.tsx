import React from 'react';
import styled from 'styled-components';

import {usePost} from 'src/hooks';
import {PlaybookRun} from 'src/types/playbook_run';

import StatusUpdateCard from './update_card';

interface Props {
    playbookRun: PlaybookRun;
}

// TODO:
// - what if markdown content is H1/H2?
// - multiple fetch?
const RHSStatusUpdates = ({playbookRun}: Props) => {
    if (playbookRun.status_posts.length === 0) {
        return null;
    }
    const statusPosts = playbookRun.status_posts;
    const sortedStatusPosts = [...statusPosts].sort((a, b) => b.create_at - a.create_at);

    return (<Container>
        {sortedStatusPosts.map((p) => (
            <StatusCard
                key={p.id}
                postId={p.id}
            />
        ))}
    </Container>);
};

export default RHSStatusUpdates;

interface StatusCardProps {
    postId: string;
}
const StatusCard = ({postId}: StatusCardProps) => {
    const post = usePost(postId);

    if (!post) {
        return null;
    }

    return (
        <Wrapper>
            <StatusUpdateCard post={post}/>
        </Wrapper>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const Wrapper = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;
