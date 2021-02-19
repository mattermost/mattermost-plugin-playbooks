// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {Link} from 'react-router-dom';

import styled from 'styled-components';

import {useRouteMatch} from 'react-router-dom';

import IncidentIcon from './assets/icons/incident_icon';
import PlaybookIcon from './assets/icons/playbook_icon';

interface Props {
}

const Icon = styled.div`
    margin-right: 9px;
    margin-top: 6px;
    margin-left: 4px;
`;

const LHS: FC<Props> = (props: Props) => {
    const match = useRouteMatch('/:team/:plugin/:section');

    return (
        <>
            <li
                className={'SidebarChannel'}
                role='listitem'
            >
                <Link
                    className={'SidebarLink ' + ((match.params.section === 'incidents') ? 'selected' : '')}
                    id={'sidebarItem_ir_incidents'}
                    to={'/rrrr/com.mattermost.plugin-incident-management/incidents'}
                >
                    <Icon>
                        <IncidentIcon/>
                    </Icon>
                    <div
                        className={'SidebarChannelLinkLabel_wrapper'}
                    >
                        <span
                            className={'SidebarChannelLinkLabel'}
                        >
                            {'Incidents'}
                        </span>
                    </div>
                </Link>
            </li>
            <li
                className={'SidebarChannel'}
                role='listitem'
            >
                <Link
                    className={'SidebarLink ' + ((match.params.section === 'playbooks') ? 'selected' : '')}
                    id={'sidebarItem_ir_playbook'}
                    to={'/rrrr/com.mattermost.plugin-incident-management/playbooks'}
                >
                    <Icon>
                        <PlaybookIcon/>
                    </Icon>
                    <div
                        className={'SidebarChannelLinkLabel_wrapper'}
                    >
                        <span
                            className={'SidebarChannelLinkLabel'}
                        >
                            {'Playbooks'}
                        </span>
                    </div>
                </Link>
            </li>
            <li
                className={'SidebarChannel'}
                role='listitem'
            >
                <Link
                    className={'SidebarLink ' + ((match.params.section === 'stats') ? 'selected' : '')}
                    id={'sidebarItem_ir_stats'}
                    to={'/rrrr/com.mattermost.plugin-incident-management/stats'}
                >
                    <Icon>
                        <div className={'fa fa-line-chart'}/>
                    </Icon>
                    <div
                        className={'SidebarChannelLinkLabel_wrapper'}
                    >
                        <span
                            className={'SidebarChannelLinkLabel'}
                        >
                            {'Statistics'}
                        </span>
                    </div>
                </Link>
            </li>
        </>
    );
};

export default LHS;
