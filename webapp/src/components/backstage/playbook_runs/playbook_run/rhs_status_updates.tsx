// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {useRunStatusUpdates} from 'src/hooks';
import {currentBackstageRHS} from 'src/selectors';

import StatusUpdateCard from './update_card';

export const RunStatusUpdatesTitle = <FormattedMessage defaultMessage={'Status updates'}/>;

const RHSStatusUpdates = () => {
    const RHS = useSelector(currentBackstageRHS);
    const playbookRunId = RHS.resourceId;
    const [statusUpdates] = useRunStatusUpdates(playbookRunId);

    if (!statusUpdates) {
        return null;
    }

    return (
        <Container data-testid={'run-rhs-statusupdates'}>
            {statusUpdates.map((post) => (
                <Wrapper key={post.id}>
                    <StatusUpdateCard post={post}/>
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
