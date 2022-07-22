import React, {ReactNode} from 'react';
import styled from 'styled-components';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';
import {useSelector} from 'react-redux';
import {Team} from 'mattermost-webapp/packages/mattermost-redux/src/types/teams';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import Scrollbars from 'react-custom-scrollbars';

import {OVERLAY_DELAY} from 'src/constants';

import {renderThumbVertical, renderTrackHorizontal, renderView} from '../rhs/rhs_shared';

import Group from './group';

export interface GroupItem {
    id?: string;
    icon: React.ReactNode;
    itemMenu?: React.ReactNode;
    display_name: string;
    className: string;
    areaLabel: string;
    link: string;
    isCollapsed: boolean;
}

export interface SidebarGroup {
    id: string;
    display_name: string;
    collapsed: boolean;
    items: Array<GroupItem>;
    afterGroup?: ReactNode;
}

interface SidebarProps {
    team_id: string;
    groups: Array<SidebarGroup>;
    headerDropdown: React.ReactNode;
}

const teamNameSelector = (teamId: string) => (state: GlobalState): Team => getTeam(state, teamId);

const Sidebar = (props: SidebarProps) => {
    let team = useSelector(teamNameSelector(props.team_id));
    if (!props.team_id) {
        team = {...team, display_name: 'All Teams', description: 'No team is selected'};
    }

    return (
        <SidebarComponent>
            <Header>
                <OverlayTrigger
                    placement='bottom'
                    delay={OVERLAY_DELAY}
                    shouldUpdatePosition={true}
                    overlay={team.description?.length ? (
                        <Tooltip id='team-name__tooltip'>{team.description}</Tooltip>
                    ) : <></>}
                >
                    <SidebarHeading>
                        <span className='title'>{team.display_name}</span>
                        <i className='icon icon-chevron-down'/>
                    </SidebarHeading>
                </OverlayTrigger>
                {props.headerDropdown}
            </Header>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                renderTrackHorizontal={renderTrackHorizontal}
                style={{
                    position: 'relative',
                    marginBottom: '40px',
                }}
            >
                {props.groups.map((group) => {
                    return (
                        <Group
                            key={group.id}
                            group={group}
                        />
                    );
                })}
            </Scrollbars>
        </SidebarComponent>
    );
};

const SidebarComponent = styled.div`
    position: fixed;
    z-index: 16;
    left: 65;
    display: flex;
    width: 240px;
    height: 100%;
    flex-direction: column;
    border-right: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    background-color: var(--sidebar-bg);
`;

const Header = styled.div`
    height: 52px;
    padding: 0 16px;

    display: flex;
    flex: initial;
    flex-flow: row nowrap;
    align-items: center;
    justify-content: space-between;
    margin: 0px;
`;

const SidebarHeading = styled.h1`
    color: var(--sidebar-header-text-color);
    cursor: pointer;
    display: flex;
    font-family: Metropolis, sans-serif;
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0px;
`;

export default Sidebar;
