// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useEffect} from 'react';
import {useDispatch} from 'react-redux';

import {setRHSOpen, startIncident} from 'src/actions';
import Spinner from 'src/components/assets/icons/spinner';
import RHSHeader from 'src/components/rhs/rhs_header';
import {CurrentIncidentState, useCurrentIncident} from 'src/hooks';

import IncidentRHSIcon from '../assets/icons/incident_rhs_icon';

import RHSIncidentDetails from './incident_details';

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

import './rhs.scss';

interface Props {	
    theme: Record<string, string>;	
}

const RightHandSidebar: FC<Props> = (props: Props) => {
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
                <div className='no-incidents'>
                    <div className='inner-text'>
                        <IncidentRHSIcon theme={props.theme}/>
                    </div>
                    <div className='inner-text'>
                        {'There is no active incident in this channel.'}
                    </div>
                    <div className='inner-text'>
                        {messageHtmlToComponent(formatText('You can create incidents by the post dropdown menu, and by the slash command `/incident start`'))}
                    </div>
                    <a
                        className='link'
                        onClick={() => dispatch(startIncident())}
                    >
                        {'+ Create new incident'}
                    </a>
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
