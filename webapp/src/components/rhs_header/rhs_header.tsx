// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Incident} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';
import {RHSState} from 'src/types/rhs';

import PlaybookIcon from './playbook_icon';

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

export default function RHSHeader(props: Props) {
    const goBack = () => {
        props.actions.setRHSState(RHSState.List);
    };

    const headerButtons = (
        <div className={'header-buttons'}>
            <OverlayTrigger
                placement='bottom'
                delay={OVERLAY_DELAY}
                overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
            >
                <button
                    className='navigation-bar__button'
                    onClick={() => props.actions.openBackstageModal(BackstageArea.Playbooks)}
                >
                    <PlaybookIcon/>
                </button>
            </OverlayTrigger>
            <OverlayTrigger
                placement='bottom'
                delay={OVERLAY_DELAY}
                overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
            >
                <button
                    className='navigation-bar__button'
                    onClick={() => props.actions.startIncident()}
                >
                    <i
                        id='incidentRHSIconPlus'
                        className='icon icon-plus'
                    />
                </button>
            </OverlayTrigger>
        </div>
    );

    return (
        <div className='navigation-bar'>
            {
                props.rhsState === RHSState.List &&
                    <React.Fragment>
                        <div>
                            <div className='title'>{'Incident List'}</div>
                        </div>
                        {headerButtons}
                    </React.Fragment>
            }
            {
                props.rhsState !== RHSState.List &&
                    <React.Fragment>
                        <div className='incident-details'>
                            <i
                                className='fa fa-angle-left'
                                onClick={goBack}
                            />
                            <div className='title'>{props.incident.name}</div>
                        </div>
                        {headerButtons}
                    </React.Fragment>
            }
        </div>
    );
}
