// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {ChecklistDetails} from 'src/components/checklist/checklist';

import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem} from 'src/types/playbook';

import Profile from 'src/components/rhs/profile';

import Link from 'src/components/rhs/link';

import './incident_details.scss';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    channelDetails: ChannelWithTeamData[];
    isCommander: boolean;
    allowEndIncident: boolean;
    actions: {
        endIncident: () => void;
        modifyChecklistItemState: (incidentID: string, checklistID: number, itemID: number, checked: boolean) => void;
        addChecklistItem: (incidentID: string, checklistID: number, checklistItem: ChecklistItem) => void;
    };
}

export default class IncidentDetails extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const incidentChannelLink = `/${this.props.channelDetails[0].team_name}/channels/${this.props.channelDetails[0].name}`;

        return (
            <div className='IncidentDetails'>
                <div className='inner-container'>
                    <div className='title'>{'Commander'}</div>
                    <Profile
                        userId={this.props.incident.commander_user_id}
                    />
                </div>

                {this.props.incident.playbook.checklists.map((checklist: Checklist, index: number) => {
                    return (
                        <ChecklistDetails
                            checklist={checklist}
                            key={checklist.title + index}
                            onChange={(itemID: number, checked: boolean) => {
                                this.props.actions.modifyChecklistItemState(this.props.incident.id, index, itemID, checked);
                            }}
                            addItem={(checklistItem: ChecklistItem) => {
                                this.props.actions.addChecklistItem(this.props.incident.id, index, checklistItem);
                            }}
                        />
                    );
                })}

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
                    this.props.isCommander &&
                    <div className='footer-div'>
                        <button
                            className='btn btn-primary'
                            onClick={() => this.props.actions.endIncident()}
                            disabled={!this.props.allowEndIncident}
                        >
                            {'End Incident'}
                        </button>
                        {
                            !this.props.allowEndIncident &&
                            <div className='help-text'>
                                {'Go to '}
                                <Link
                                    to={incidentChannelLink}
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
