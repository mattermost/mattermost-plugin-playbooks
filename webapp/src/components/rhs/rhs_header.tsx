// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Permissions} from 'mattermost-redux/constants';

import {Team} from 'mattermost-redux/types/teams';

import {useSelector, useDispatch} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {navigateToTeamPluginUrl} from 'src/browser_routing';

import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import PlusIcon from 'src/components/assets/icons/plus_icon';
import {OVERLAY_DELAY} from 'src/constants';
import {isMobile} from 'src/mobile';

import './rhs_header.scss';

import {useCurrentTeamPermission} from 'src/hooks';
import {startIncident} from 'src/actions';

export default function RHSHeader() {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const canCreatePublicChannels =
        useCurrentTeamPermission(
            {
                permission: Permissions.CREATE_PUBLIC_CHANNEL,
            });
    const canCreatePrivateChannels =
        useCurrentTeamPermission(
            {
                permission: Permissions.CREATE_PRIVATE_CHANNEL,
            });
    const canCreateChannels = canCreatePublicChannels || canCreatePrivateChannels;

    return (
        <div className='rhs-header-bar'>
            <div>
                {/* filter dropdown placeholder */}
            </div>

            <div className={'header-buttons'}>
                {
                    !isMobile() &&
                        <OverlayTrigger
                            placement='bottom'
                            delay={OVERLAY_DELAY}
                            overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
                        >
                            <button
                                className='rhs-header-bar__button'
                                onClick={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                            >
                                <PlaybookIcon/>
                            </button>
                        </OverlayTrigger>
                }
                {
                    canCreateChannels &&
                        <OverlayTrigger
                            placement='bottom'
                            delay={OVERLAY_DELAY}
                            overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
                        >
                            <button
                                className='rhs-header-bar__button'
                                onClick={() => dispatch(startIncident())}
                            >
                                <PlusIcon/>
                            </button>
                        </OverlayTrigger>
                }
            </div>
        </div>
    );
}
