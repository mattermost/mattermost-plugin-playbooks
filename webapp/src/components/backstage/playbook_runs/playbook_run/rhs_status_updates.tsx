import React from 'react';
import styled from 'styled-components';

import {PlaybookRun, StatusPostComplete} from 'src/types/playbook_run';

import StatusUpdateCard from './update_card';

interface Props {
    playbookRun: PlaybookRun;
    statusUpdates: StatusPostComplete[];
}

const RHSStatusUpdates = ({playbookRun, statusUpdates}: Props) => {
    if (playbookRun.status_posts.length === 0) {
        return null;
    }

    return (<Container>
        {statusUpdates.map((post) => (
            <Wrapper key={post.id}>
                <StatusUpdateCard post={post}/>
            </Wrapper>
        ))}
    </Container>);
};

export default RHSStatusUpdates;

const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

const Wrapper = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;
