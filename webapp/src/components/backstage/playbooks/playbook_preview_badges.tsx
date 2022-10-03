// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import {PillBox} from 'src/components/widgets/pill';
import {useChannel} from 'src/hooks/general';

const Badge = styled(PillBox)`
    font-size: 11px;
    height: 20px;
    line-height: 16px;
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    padding-left: 1px;
    padding-right: 8px;

    :not(:last-child) {
        margin-right: 8px;
    }

    i {
        color: rgba(var(--center-channel-color-rgb), 0.72);
        margin-top: -1px;
        margin-right: 3px;
    }

    font-weight: 600;
    font-size: 11px;
`;

export const TextBadge = styled(Badge)`
    text-transform: uppercase;

    padding: 0 6px;
`;

export const EllipsizedText = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export const ChannelBadge = ({channelId} : { channelId: string }) => {
    const [channel] = useChannel(channelId);

    return (
        <Badge key={channelId}>
            <i className={'icon-globe icon-12'}/>
            {channel?.display_name}
        </Badge>
    );
};

