// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {useDispatch, useSelector} from 'react-redux';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {GlobalState} from 'mattermost-redux/types/store';

import UpgradeBadge from 'src/components/backstage/upgrade_badge';

import {RHSTabState} from 'src/types/rhs';
import {currentIncident, currentRHSTabState} from 'src/selectors';
import {setRHSTabState} from 'src/actions';
import {Incident} from 'src/types/incident';
import {telemetryEventForIncident} from 'src/client';

import {useAllowTimelineViewInCurrentTeam} from 'src/hooks';

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
    const incident = useSelector<GlobalState, Incident>(currentIncident);
    const allowTimelineView = useAllowTimelineViewInCurrentTeam();

    const setTabState = (nextState: RHSTabState) => {
        if (currentTabState !== nextState) {
            dispatch(setRHSTabState(channelId, nextState));
        }
    };

    return (
        <TabRow>
            <TabItem
                active={currentTabState === RHSTabState.ViewingAbout}
                onClick={() => setTabState(RHSTabState.ViewingAbout)}
                data-testid='about'
            >
                {'About'}
            </TabItem>
            <TabItem
                active={currentTabState === RHSTabState.ViewingTasks}
                onClick={() => setTabState(RHSTabState.ViewingTasks)}
                data-testid='tasks'
            >
                {'Tasks'}
            </TabItem>
            <TabItem
                active={currentTabState === RHSTabState.ViewingTimeline}
                onClick={() => {
                    setTabState(RHSTabState.ViewingTimeline);
                    telemetryEventForIncident(incident.id, 'timeline_tab_clicked');
                }}
                data-testid='timeline'
            >
                {'Timeline'}
                {!allowTimelineView && <PositionedUpgradeBadge/>}
            </TabItem>
        </TabRow>
    );
};

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-bottom: -3px;
    margin-left: 4px;
`;

export default RHSTabView;
