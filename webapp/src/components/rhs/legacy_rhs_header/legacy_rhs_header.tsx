// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {Incident} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';
import {RHSState} from 'src/types/rhs';

import PlaybookIcon from 'src/components/assets/icons/playbook_icon';
import PlusIcon from 'src/components/assets/icons/plus_icon';

import './legacy_rhs_header.scss';

interface Props {
    rhsState: RHSState;
    incident: Incident;
    isLoading: boolean;
    isMobile: boolean;
    actions: {
        startIncident: () => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
        openBackstageModal: (selectedArea: BackstageArea) => void;
    };
}

const OVERLAY_DELAY = 400;

export default function LegacyRHSHeader(props: Props) {
    const goBack = () => {
        props.actions.setRHSState(RHSState.List);
    };

    const commonClassName = 'legacy-rhs-header';

    const playbooksIcon = (
        <OverlayTrigger
            placement='bottom'
            delay={OVERLAY_DELAY}
            overlay={<Tooltip id='playbooksTooltip'>{'Playbooks'}</Tooltip>}
        >
            <button
                className={commonClassName + '__button'}
                onClick={() => props.actions.openBackstageModal(BackstageArea.Playbooks)}
            >
                <i>
                    <PlaybookIcon/>
                </i>
            </button>
        </OverlayTrigger>
    );

    const newPlaybookIcon = (
        <OverlayTrigger
            placement='bottom'
            delay={OVERLAY_DELAY}
            overlay={<Tooltip id='startIncidentTooltip'>{'Start New Incident'}</Tooltip>}
        >
            <button
                className={commonClassName + '__button'}
                onClick={() => props.actions.startIncident()}
            >
                <PlusIcon/>
            </button>
        </OverlayTrigger>
    );

    let headerTitle;
    if (props.isMobile) {
        if (props.rhsState === RHSState.List) {
            headerTitle = (
                <div>
                    <div className='title'>{'Incident List'}</div>
                </div>
            );
        } else {
            headerTitle = (
                <div className='incident-details'>
                    <i
                        className={'fa fa-angle-left ' + commonClassName + '__button'}
                        onClick={goBack}
                    />
                    <div className='title'>{props.incident.name}</div>
                </div>
            );
        }
    }

    let widthAwareClassName;
    if (props.isMobile) {
        widthAwareClassName = commonClassName + '-mobile';
    } else {
        widthAwareClassName = commonClassName + '-desktop';
    }

    return (
        <div className={commonClassName + ' ' + widthAwareClassName}>
            {headerTitle}
            <div className={widthAwareClassName + '__header-buttons'}>
                { !props.isMobile && playbooksIcon }
                {newPlaybookIcon}
            </div>
        </div>
    );
}
