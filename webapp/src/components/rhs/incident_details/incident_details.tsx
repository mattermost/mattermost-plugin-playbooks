// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import _ from 'lodash';

import {UserProfile} from 'mattermost-redux/types/users';
import {Channel} from 'mattermost-redux/types/channels';

import {Incident} from 'src/types/incident';

import Checkbox from './checkbox';
import Link from './link';
import Profile from './profile';

import './incident_details.scss';
import {getDisplayName} from 'src/utils/utils';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    channelDetails: Channel[];
    actions: {
        fetchUser: (id: string) => void;
        fetchChannel: (id: string) => void;
    };
}

export default class IncidentDetails extends React.PureComponent<Props> {
    public componentDidMount(): void {
        if (!this.props.commander) {
            this.props.actions.fetchUser(this.props.incident.commander_user_id);
        }
    }

    public componentDidUpdate(prevProp: Props): void {
        if (this.props.incident?.channel_ids && this.props.incident?.channel_ids?.length !== prevProp.incident?.channel_ids?.length) {
            for (const channelId of this.props.incident.channel_ids) {
                this.props.actions.fetchChannel(channelId);
            }
        }
    }

    public render(): JSX.Element {
        let commanderName = '';
        if (this.props.commander) {
            commanderName = getDisplayName(this.props.commander);
        }

        return (
            <div className='IncidentDetails'>
                <div className='inner-container'>
                    <div className='title'>{'Commander'}</div>
                    <Profile
                        profileUri={this.props.profileUri}
                        name={commanderName}
                    />
                </div>

                {/* Checkbox example
                    <div className='inner-container'>
                        <div className='title'>{'Checklist'}</div>
                        <Checkbox
                            checked={true}
                            text={'Triage Issue in Jira'}
                        />
                    </div>
                */}

                <div className='inner-container'>
                    <div className='title'>{'Channels'}</div>
                    {
                        this.props.channelDetails.map((channel) => (
                            <Link
                                key={channel.id}
                                text={channel.display_name}
                            />
                        ))
                    }
                </div>
            </div>
        );
    }
}
