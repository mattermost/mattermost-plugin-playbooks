// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

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

export default class IncidentDetails extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const [isConfirmingEnd, setConfirmingEnd] = useState(false);

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
                        onClick={

                            //() => this.props.actions.endIncident(this.props.incident.id)
                            () => setConfirmingEnd(true)
                        }
                    >
                        {'End Incident'}
                    </button>
                </div>
                }

                {isConfirmingEnd &&
                <ConfirmModal
                    onCancel={setConfirmingEnd(false)}
                    onConfirm={setConfirmingEnd(false)}
                    show={true}
                    title={'Test'}
                    message={'Message test.'}
                />
                }
            </div>
        );
    }
}
