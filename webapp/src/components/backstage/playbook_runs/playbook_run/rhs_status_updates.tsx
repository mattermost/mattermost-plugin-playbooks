// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import StatusUpdateCard from './update_card';

interface Props {
    statusUpdates?: {
        id: string
        authorUserName: string
        createAt: number
        message: string
    }[]
}

const RHSStatusUpdates = (props: Props) => {
    if (!props.statusUpdates || props.statusUpdates.length === 0) {
        return null;
    }

    return (
        <Container data-testid={'run-rhs-statusupdates'}>
            {props.statusUpdates.map((post) => (
                <Wrapper key={post.id}>
                    <StatusUpdateCard
                        authorUserName={post.authorUserName}
                        createAt={post.createAt}
                        message={post.message}
                    />
                </Wrapper>
            ))}
        </Container>
    );
};

export default RHSStatusUpdates;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 25px;
`;

const Wrapper = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;
