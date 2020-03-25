// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';

import {Incident} from 'src/types/incident';

import './incident_item.scss';

interface Props {
    incident: Incident;
    commander: UserProfile;
    onClick?: () => void;
    actions: {
        fetchUser: (id: string) => void;
    };
}

export default class IncidentItem extends React.PureComponent<Props> {
    public componentDidMount(): void {
        if (!this.props.commander) {
            this.props.actions.fetchUser(this.props.incident.commander_user_id);
        }
    }

    public render(): JSX.Element {
        const commanderUsername = this.props.commander ? `@${this.props.commander.username}` : '';

        return (
            <div className='IncidentItem'>
                <div
                    className='list'
                    key={this.props.incident.id}
                    onClick={this.props.onClick}
                >
                    <div>
                        {this.props.incident.name}
                    </div>
                    <div
                        className='light'
                    >
                        {'Commander: ' + commanderUsername}
                    </div>
                </div>
            </div>
        );
    }
}
