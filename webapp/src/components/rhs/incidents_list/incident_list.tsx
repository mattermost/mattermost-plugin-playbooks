// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import IncidentItem from 'src/components/rhs/incident_item';
import {Incident} from 'src/types/incident';

import IncidentListIcon from './list_icon';

// @ts-ignore
const {formatText, messageHtmlToComponent} = window.PostUtils;

interface Props {
    incidents: Incident[];
    onClick: (id: string) => void;
    actions: {
        startIncident: () => void;
    };
}

export default class IncidentList extends React.PureComponent<Props> {
    public render(): JSX.Element {
        if (this.props.incidents.length === 0) {
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
                        className='link'
                        onClick={this.props.actions.startIncident}
                    >
                        {'+ Create new incident'}
                    </a>
                </div>
            );
        }

        return this.props.incidents.map((i) => (
            <IncidentItem
                key={i.id}
                incident={i}
                onClick={() => this.props.onClick(i.id)}
            />
        ));
    }
}
