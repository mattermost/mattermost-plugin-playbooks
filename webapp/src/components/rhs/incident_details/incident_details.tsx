// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import _ from 'lodash';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {Incident} from 'src/types/incident';

import {getDisplayName} from 'src/utils/utils';

import Link from './link';
import Profile from './profile';

import './incident_details.scss';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    channelDetails: ChannelWithTeamData[];

}

export default class IncidentDetails extends React.PureComponent<Props> {
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
                        this.props.channelDetails.map((channel: ChannelWithTeamData) => (
                            <Link
                                key={channel.id}
                                text={channel.display_name}
                                href={`/${channel.team_name}/channels/${channel.id}`}
                            />
                        ))
                    }
                </div>
            </div>
        );
    }
}
