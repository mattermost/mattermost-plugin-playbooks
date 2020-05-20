// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {UserProfile} from 'mattermost-redux/types/users';
import {ChannelWithTeamData} from 'mattermost-redux/types/channels';

import {fetchUsersInChannel, setCommander} from 'src/client';
import {ChecklistDetails} from 'src/components/checklist/checklist';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile/profile_selector/profile_selector';
import Link from 'src/components/rhs/link';

// @ts-ignore
const WebappUtils = window.WebappUtils;

import './incident_details.scss';
import {isMobile} from 'src/utils/utils';

interface Props {
    incident: Incident;
    commander: UserProfile;
    profileUri: string;
    primaryChannelDetails: ChannelWithTeamData;
    viewingIncidentChannel: boolean;
    involvedInIncident: boolean;
    teamName: string;
    actions: {
        endIncident: () => void;
        modifyChecklistItemState: (incidentID: string, checklistNum: number, itemNum: number, checked: boolean) => void;
        addChecklistItem: (incidentID: string, checklistNum: number, checklistItem: ChecklistItem) => void;
        removeChecklistItem: (incidentID: string, checklistNum: number, itemNum: number) => void;
        renameChecklistItem: (incidentID: string, checklistNum: number, itemNum: number, newtitle: string) => void;
        reorderChecklist: (incidentID: string, checklistNum: number, itemNum: number, newPosition: number) => void;
        toggleRHS: () => void;
    };
}

export function renderView(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

export default class RHSIncidentDetails extends React.PureComponent<Props> {
    private moveToDM(userName: string) {
        WebappUtils.browserHistory.push(`/${this.props.teamName}/messages/@${userName}`);
        if (isMobile()) {
            this.props.actions.toggleRHS();
        }
    }

    public render(): JSX.Element {
        const fetchUsers = async () => {
            return fetchUsersInChannel(this.props.primaryChannelDetails.id);
        };

        const onSelectedChange = async (userId?: string) => {
            if (!userId) {
                return;
            }
            const response = await setCommander(this.props.incident.id, userId);
            if (response.error) {
                // TODO: Should be presented to the user? https://mattermost.atlassian.net/browse/MM-24271
                console.log(response.error); // eslint-disable-line no-console
            }
        };

        return (
            <React.Fragment>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    style={{position: 'absolute'}}
                >
                    <div className='IncidentDetails'>
                        <div className='inner-container'>
                            <div className='title'>{'Commander'}</div>
                            <ProfileSelector
                                commanderId={this.props.incident.commander_user_id}
                                enableEdit={this.props.involvedInIncident && this.props.viewingIncidentChannel}
                                getUsers={fetchUsers}
                                onSelectedChange={onSelectedChange}
                            />
                        </div>

                        {this.props.incident.playbook.checklists?.map((checklist: Checklist, index: number) => (
                            <ChecklistDetails
                                checklist={checklist}
                                enableEdit={this.props.involvedInIncident && this.props.viewingIncidentChannel}
                                key={checklist.title + index}
                                onChange={(itemNum: number, checked: boolean) => {
                                    this.props.actions.modifyChecklistItemState(this.props.incident.id, index, itemNum, checked);
                                }}
                                addItem={(checklistItem: ChecklistItem) => {
                                    this.props.actions.addChecklistItem(this.props.incident.id, index, checklistItem);
                                }}
                                removeItem={(itemNum: number) => {
                                    this.props.actions.removeChecklistItem(this.props.incident.id, index, itemNum);
                                }}
                                editItem={(itemNum: number, newTitle: string) => {
                                    this.props.actions.renameChecklistItem(this.props.incident.id, index, itemNum, newTitle);
                                }}
                                reorderItems={(itemNum: number, newPosition: number) => {
                                    this.props.actions.reorderChecklist(this.props.incident.id, index, itemNum, newPosition);
                                }}
                            />
                        ))}

                        {
                            this.props.involvedInIncident &&
                            <div className='inner-container'>
                                <div className='title'>{'Channel'}</div>
                                <Link
                                    key={this.props.primaryChannelDetails.id}
                                    to={`/${this.props.primaryChannelDetails.team_name}/channels/${this.props.primaryChannelDetails.name}`}
                                    text={this.props.primaryChannelDetails.display_name}
                                />
                            </div>
                        }
                    </div>
                </Scrollbars>
                <div className='footer-div'>
                    {
                        this.props.involvedInIncident &&
                        <>
                            <button
                                className='btn btn-primary'
                                onClick={() => this.props.actions.endIncident()}
                                disabled={!this.props.viewingIncidentChannel}
                            >
                                {'End Incident'}
                            </button>
                            {
                                !this.props.viewingIncidentChannel &&
                                <div className='help-text'>
                                    {'Go to '}
                                    <Link
                                        to={`/${this.props.primaryChannelDetails.team_name}/channels/${this.props.primaryChannelDetails.name}`}
                                        text={'the incident channel'}
                                    />
                                    {' to make changes.'}
                                </div>
                            }
                        </>
                    }

                    {
                        !this.props.involvedInIncident &&
                        <div className='help-text'>
                            {'You are not a participant in the incident. Contact '}
                            <a
                                onClick={() => this.moveToDM(this.props.commander.username)}
                            >
                                {'@' + this.props.commander.username}
                            </a>
                            {' to request access.'}
                        </div>
                    }
                </div>
            </React.Fragment>
        );
    }
}
