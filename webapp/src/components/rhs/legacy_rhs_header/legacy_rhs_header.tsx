// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Incident} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';
import {RHSState} from 'src/types/rhs';

import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import PlusIcon from 'src/components/assets/icons/plus_icon';

import './legacy_rhs_header.scss'

interface Props {
    rhsState: RHSState;
    incident: Incident;
    isLoading: boolean;
    actions: {
        startIncident: () => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
        openBackstageModal: (selectedArea: BackstageArea) => void;
    };
}

const OVERLAY_DELAY = 400;

export default function LegacyRHSHeader(props: Props) {
    return (
        <div className='legacy-rhs-header'>
            <div className='legacy-rhs-header__header-buttons'>
                <OverlayTrigger
                    placement='bottom'
                    delay={OVERLAY_DELAY}
                    overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
                >
                    <button
                        className='legacy-rhs-header__button'
                        onClick={() => props.actions.openBackstageModal(BackstageArea.Playbooks)}
                    >
                    <i>
                        <PlaybookIcon/>
                    </i>
                    </button>
                </OverlayTrigger>
                <OverlayTrigger
                    placement='bottom'
                    delay={OVERLAY_DELAY}
                    overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
                >
                    <button
                        className='legacy-rhs-header__button'
                        onClick={() => props.actions.startIncident()}
                    >
                        <PlusIcon/>
                    </button>
                </OverlayTrigger>
            </div>
        </div>
    );
}
