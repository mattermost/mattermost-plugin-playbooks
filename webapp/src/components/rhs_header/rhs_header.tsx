// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHSState, Incident} from 'src/types/incident';
import {BackstageArea} from 'src/types/backstage';

import PlaybookIcon from './playbook_icon';

interface Props {
    rhsState: RHSState;
    incident: Incident;
    isLoading: boolean;
    actions: {
        startIncident: () => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
        toggleRHS: () => void;
        openBackstageModal: (selectedArea: BackstageArea) => void;
    };
}

export default function RHSHeader(props: Props) {
    const goBack = () => {
        props.actions.setRHSState(RHSState.List);
    };

    const closeRHS = () => {
        props.actions.toggleRHS();
    };

    const headerButtons = (
        <div className={'header-buttons'}>
            <button
                className='navigation-bar__button'
                onClick={() => props.actions.openBackstageModal(BackstageArea.Playbooks)}
            >
                <PlaybookIcon/>
            </button>
            <button
                className='navigation-bar__button'
                onClick={() => props.actions.startIncident()}
            >
                <i
                    id='rhsIconPlus'
                    className='icon icon-plus'
                />
            </button>
            <button
                className='navigation-bar__button ml-1'
                onClick={closeRHS}
            >
                <i
                    className='icon icon-close'
                />
            </button>
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
