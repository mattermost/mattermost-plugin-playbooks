// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {BackstageArea} from 'src/types/backstage';

import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import PlusIcon from 'src/components/assets/icons/plus_icon';
import {OVERLAY_DELAY} from 'src/utils/constants';
import {navigateToTeamPluginUrl} from 'src/utils/utils';

import './rhs_header.scss';

interface Props {
    isMobile: boolean;
    hasPermissionToCreateChannels: boolean;
    currentTeamName: string;
    actions: {
        startIncident: () => void;
    };
}

export default function RHSHeader(props: Props) {
    return (
        <div className='rhs-header-bar'>
            <React.Fragment>
                <div>
                    {/* filter dropdown placeholder */}
                </div>

                <div className={'header-buttons'}>
                    {
                        !props.isMobile &&
                        <OverlayTrigger
                            placement='bottom'
                            delayShow={OVERLAY_DELAY}
                            overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
                        >
                            <button
                                className='rhs-header-bar__button'
                                onClick={() => navigateToTeamPluginUrl(props.currentTeamName, '/playbooks')}
                            >
                                <PlaybookIcon/>
                            </button>
                        </OverlayTrigger>
                    }
                    {
                        props.hasPermissionToCreateChannels &&
                        <OverlayTrigger
                            placement='bottom'
                            delayShow={OVERLAY_DELAY}
                            overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
                        >
                            <button
                                className='rhs-header-bar__button'
                                onClick={() => props.actions.startIncident()}
                            >
                                <PlusIcon/>
                            </button>
                        </OverlayTrigger>
                    }
                </div>
            </React.Fragment>
        </div>
    );
}
