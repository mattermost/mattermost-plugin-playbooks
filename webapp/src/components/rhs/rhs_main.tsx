// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {setRHSOpen} from 'src/actions';
import Spinner from 'src/components/assets/icons/spinner';
import RHSHeader from 'src/components/rhs/rhs_header';
import {CurrentIncidentState, useCurrentIncident} from 'src/hooks';

import RHSIncidentDetails from './incident_details';
import './rhs.scss';

const RightHandSidebar: FC = () => {
    const dispatch = useDispatch();
    const [incident, incidentState] = useCurrentIncident();

    useEffect(() => {
        dispatch(setRHSOpen(true));
        return () => {
            dispatch(setRHSOpen(false));
        };
    }, []);

    if (incidentState === CurrentIncidentState.Loading) {
        return (
            <div className='incident-rhs'>
                <div className='incident-rhs__content'>
                    <div className='spinner-container'>
                        <Spinner/>
                        <span>{'Loading...'}</span>
                    </div>
                </div>
            </div>
        );
    } else if (incident === null || incidentState === CurrentIncidentState.NotFound) {
        return (
            <div className='incident-rhs'>
                <div className='incident-rhs__content'>
                    {'No incident for this channel.'}
                </div>
            </div>
        );
    }

    return (
        <div className='incident-rhs'>
            <RHSHeader/>
            <div className='incident-rhs__content'>
                <RHSIncidentDetails
                    incident={incident}
                />
            </div>
        </div>
    );
};

export default RightHandSidebar;
