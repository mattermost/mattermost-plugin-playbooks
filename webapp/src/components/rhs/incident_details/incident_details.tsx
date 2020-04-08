// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import ConfirmModal from 'mattermost-webapp/components/confirm_modal';

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
        endIncident: (id: string) => void;
    };
}

interface State {
    isConfirmingEnd: boolean;
}

export default class IncidentDetails extends React.PureComponent<Props> {
    state: State = {
        isConfirmingEnd: false,
    };

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

                {this.props.allowEndIncident &&
                <div className='footer-div'>
                    <button
                        className='btn btn-primary'
                        onClick={() => this.setState({isConfirmingEnd: true})}
                    >
                        {'End Incident'}
                    </button>
                </div>
                }

                {this.state.isConfirmingEnd &&
                <ConfirmModal
                    onCancel={() => this.setState({isConfirmingEnd: false})}
                    onConfirm={() => this.props.actions.endIncident(this.props.incident.id)}
                    onExit={() => this.setState({isConfirmingEnd: false})}
                    confirmButtonText={'Confirm'}
                    show={true}
                    title={'Confirm End Incident'}
                    message={`This will end incident ${this.props.incident.name}. It will close the details view in the RHS, and remove the incident from the Incident List. \n \n Are you sure?`}
                />
                }
            </div>
        );
    }
}
