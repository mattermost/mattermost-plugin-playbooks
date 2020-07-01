// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import Scrollbars from 'react-custom-scrollbars';

import {useDispatch} from 'react-redux';

import {fetchUsersInChannel, setCommander, checkItem, uncheckItem, clientAddChecklistItem, clientRenameChecklistItem, clientRemoveChecklistItem, clientReorderChecklist} from 'src/client';
import {ChecklistDetails} from 'src/components/checklist';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile_selector';

import {isMobile} from 'src/mobile';
import {toggleRHS, endIncident} from 'src/actions';
import './incident_details.scss';

interface Props {
    incident: Incident;
}

function renderView(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

function renderThumbHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

function renderThumbVertical(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

const RHSIncidentDetails: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    const fetchUsers = async () => {
        return fetchUsersInChannel(props.incident.primary_channel_id);
    };

    const onSelectedProfileChange = async (userId?: string) => {
        if (!userId) {
            return;
        }
        const response = await setCommander(props.incident.id, userId);
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
                            commanderId={props.incident.commander_user_id}
                            enableEdit={true}
                            getUsers={fetchUsers}
                            onSelectedChange={onSelectedProfileChange}
                        />
                    </div>

                    {props.incident.playbook.checklists?.map((checklist: Checklist, index: number) => (
                        <ChecklistDetails
                            checklist={checklist}
                            enableEdit={true}
                            key={checklist.title + index}
                            onChange={(itemNum: number, checked: boolean) => {
                                if (checked) {
                                    checkItem(props.incident.id, index, itemNum);
                                } else {
                                    uncheckItem(props.incident.id, index, itemNum);
                                }
                            }}
                            onRedirect={() => {
                                if (isMobile()) {
                                    dispatch(toggleRHS());
                                }
                            }}
                            addItem={(checklistItem: ChecklistItem) => {
                                clientAddChecklistItem(props.incident.id, index, checklistItem);
                            }}
                            removeItem={(itemNum: number) => {
                                clientRemoveChecklistItem(props.incident.id, index, itemNum);
                            }}
                            editItem={(itemNum: number, newTitle: string) => {
                                clientRenameChecklistItem(props.incident.id, index, itemNum, newTitle);
                            }}
                            reorderItems={(itemNum: number, newPosition: number) => {
                                clientReorderChecklist(props.incident.id, index, itemNum, newPosition);
                            }}
                        />
                    ))}
                </div>
            </Scrollbars>
            <div className='footer-div'>
                <button
                    className='btn btn-primary'
                    onClick={() => dispatch(endIncident())}
                >
                    {'End Incident'}
                </button>
            </div>
        </React.Fragment>
    );
};

export default RHSIncidentDetails;
