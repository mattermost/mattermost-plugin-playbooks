// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import {RHSTabState} from 'src/types/rhs';
import {currentRHSTabState} from 'src/selectors';
import {setRHSTabState} from 'src/actions';

const TabRow = styled.div`
    display: flex;
    flex-direction: row;
`;

interface TabItemProps {
    active: boolean;
}

const TabItem = styled.div<TabItemProps>`
    flex: 1;
    text-align: center;
    line-height: 48px;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    cursor: pointer;

    box-shadow: inset 0px -2px 0px var(--center-channel-color-16);
    ${(props) => props.active && css`
        box-shadow: inset 0px -2px 0px var(--button-bg);
        color: var(--button-bg);
    `}
`;

const RHSTabView = () => {
    const dispatch = useDispatch();
    const currentTabState = useSelector<GlobalState, RHSTabState>(currentRHSTabState);
    const channelId = useSelector<GlobalState, string>(getCurrentChannelId);

    const setTabState = (nextState: RHSTabState) => {
        if (currentTabState !== nextState) {
            dispatch(setRHSTabState(channelId, nextState));
        }
    };

    return (
        <TabRow>
            <TabItem
                active={currentTabState === RHSTabState.ViewingSummary}
                onClick={() => setTabState(RHSTabState.ViewingSummary)}
            >
                {'Summary'}
            </TabItem>
            <TabItem
                active={currentTabState === RHSTabState.ViewingTasks}
                onClick={() => setTabState(RHSTabState.ViewingTasks)}
            >
                {'Tasks'}
            </TabItem>
        </TabRow>
    );
};

export default RHSTabView;
