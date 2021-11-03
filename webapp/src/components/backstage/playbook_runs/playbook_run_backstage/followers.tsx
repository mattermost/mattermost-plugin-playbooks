// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {RHSParticipant, Rest} from 'src/components/rhs/rhs_participant';

interface Props {
    userIds: string[];
}

const Followers = (props: Props) => {
    if (props.userIds.length === 0) {
        return (
            <FollowersWrapper>
                {'No followers yet. '}
            </FollowersWrapper>
        );
    }
    return (
        <>
            <FollowersWrapper>
                {props.userIds.length + ' follower' + (props.userIds.length > 1 ? 's' : '')}
            </FollowersWrapper>
            <UserRow
                tabIndex={0}
                role={'button'}
            >
                {props.userIds.slice(0, 5).map((userId: string) => (
                    <RHSParticipant
                        key={userId}
                        userId={userId}
                        sizeInPx={20}
                    />
                ))}
                {props.userIds.length > 5 &&
                    <Rest sizeInPx={20}>{'+' + (props.userIds.length - 5)}</Rest>
                }
            </UserRow>
        </>
    );
};

const FollowersWrapper = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 11px;
    line-height: 16px;

    margin-left: auto;
`;

const UserRow = styled.div`
    width: max-content;
    padding: 0;
    display: flex;
    flex-direction: row;

    border-radius: 44px;
    margin-left: 12px;

    :hover {
        border-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-clip: padding-box;
    }
`;

export default Followers;
