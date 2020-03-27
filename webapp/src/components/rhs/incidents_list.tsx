// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Incident} from 'src/types/incident';

import IncidentListIcon from './icon';

import IncidentItem from './incident_item';

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

interface Props {
    incidents: Incident[];
    onClick: (id: string) => void;
}

export const IncidentsList = ({incidents, onClick}: Props): JSX.Element => {
    if (incidents.length === 0) {
        return (
            <div className='no-incidents'>
                <div className='inner-text'>
                    <IncidentListIcon/>
                </div>
                <div className='inner-text'>
                    {'There are no active incidents yet.'}
                </div>
                <div className='inner-text'>
                    {messageHtmlToComponent(formatText('You can create incidents by the post dropdown menu, and by the slash command `/incident start`'))}
                </div>
                <a
                    className='mt-5 style--none color--link'
                >
                    {'+ Create new incident'}
                </a>
            </div>
        );
    }

    return incidents.map((i) => (
        <IncidentItem
            key={i.id}
            incident={i}
            onClick={() => onClick(i.id)}
        />
    ));
};