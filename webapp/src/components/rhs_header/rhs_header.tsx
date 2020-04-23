// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {RHSState, Incident} from 'src/types/incident';

interface Props {
    rhsState: RHSState;
    incident: Incident;
    isLoading: boolean;
    toggleRHS: () => void;
    actions: {
        startIncident: () => void;
        setRHSState: (state: RHSState) => void;
        setRHSOpen: (open: boolean) => void;
    };
}

export default function RhsHeader(props: Props) {
    const goBack = () => {
        props.actions.setRHSState(RHSState.List);
    };

    const closeRhs = () => {
        props.toggleRHS();
    };

    const headerButtons = (
        <div className={'header-buttons'}>
            <button
                className='start-incident'
                onClick={() => props.actions.startIncident()}
            >
                <i
                    className='icon icon-plus'
                />
            </button>
            <button
                className='start-incident'
                onClick={closeRhs}
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
