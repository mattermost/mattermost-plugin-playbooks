// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {Incident} from 'src/types/incident';

import Profile from 'src/components/rhs/profile';

import Link from 'src/components/rhs/link';

import './incident_details.scss';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    channelDetails: ChannelWithTeamData[];
    allowEndIncident: boolean;
    actions: {
        endIncident: () => void;
    };
}

export default class IncidentDetails extends React.PureComponent<Props> {
    public render(): JSX.Element {
        return (
            <div className='IncidentDetails'>
                <div className='inner-container'>
                    <div className='title'>{'Commander'}</div>
                    <Profile
                        userId={this.props.incident.commander_user_id}
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

                {
                    this.props.channelDetails.length > 0 &&
                    <div className='inner-container'>
                        <div className='title'>{'Channels'}</div>
                        {
                            this.props.channelDetails.map((channel: ChannelWithTeamData) => (
                                <Link
                                    key={channel.id}
                                    to={`/${channel.team_name}/channels/${channel.name}`}
                                    text={channel.display_name}
                                />
                            ))
                        }
                    </div>
                }

                {
                    this.props.channelDetails?.length > 0 &&
                    <div className='footer-div'>
                        <button
                            className='btn btn-primary'
                            onClick={() => this.props.actions.endIncident()}
                            disabled={!this.props.allowEndIncident}
                        >
                            {'End Incident'}
                        </button>
                        {
                            !this.props.allowEndIncident && this.props.channelDetails?.length > 0 &&
                            <div className='help-text'>
                                {'Go to '}
                                <Link
                                    to={`/${this.props.channelDetails[0].team_name}/channels/${this.props.channelDetails[0].name}`}
                                    text={'the incident channel'}
                                />
                                {' to enable this action.'}
                            </div>
                        }
                    </div>
                }
            </div>
        );
    }
}
