// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import Scrollbars from 'react-custom-scrollbars';

import ReactSelect, {ActionMeta, OptionTypeBase} from 'react-select';

import {useDispatch} from 'react-redux';

import {fetchUsersInChannel, setCommander, checkItem, uncheckItem, clientAddChecklistItem, clientEditChecklistItem, clientRemoveChecklistItem, clientReorderChecklist} from 'src/client';
import {ChecklistDetails} from 'src/components/checklist';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem, emptyChecklist} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile/profile_selector';

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

interface Option {
    value: number;
    label: string;
}

type ActionObj = ActionMeta<OptionTypeBase>;

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

    const [selectedChecklistIndex, setSelectedChecklistIndex] = useState(0);

    const checklists = props.incident.playbook.checklists || [];
    const selectedChecklist = checklists[selectedChecklistIndex] || emptyChecklist();

    const onChecklistChange = (option: Option, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }

        setSelectedChecklistIndex(option.value);
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
                    <div className='inner-container'>
                        <div className='title'>{'Stage'}</div>
                        <ReactSelect
                            options={checklists.map((checklist, idx) => {
                                return {value: idx, label: checklist.title};
                            })}
                            onChange={(option, action) => onChecklistChange(option as Option, action as ActionObj)}
                            defaultValue={{value: selectedChecklistIndex, label: selectedChecklist.title}}
                            className={'incident-stage-select'}
                            classNamePrefix={'incident-stage-select'}
                        />
                    </div>
                    <ChecklistDetails
                        checklist={selectedChecklist}
                        enableEditChecklistItems={true}
                        overwriteTitle={'Checklist'}
                        key={selectedChecklist.title + selectedChecklistIndex}
                        onChange={(itemNum: number, checked: boolean) => {
                            if (checked) {
                                checkItem(props.incident.id, selectedChecklistIndex, itemNum);
                            } else {
                                uncheckItem(props.incident.id, selectedChecklistIndex, itemNum);
                            }
                        }}
                        onRedirect={() => {
                            if (isMobile()) {
                                dispatch(toggleRHS());
                            }
                        }}
                        addItem={(checklistItem: ChecklistItem) => {
                            clientAddChecklistItem(props.incident.id, selectedChecklistIndex, checklistItem);
                        }}
                        removeItem={(itemNum: number) => {
                            clientRemoveChecklistItem(props.incident.id, selectedChecklistIndex, itemNum);
                        }}
                        editItem={(itemNum: number, newItem: ChecklistItem) => {
                            clientEditChecklistItem(props.incident.id, selectedChecklistIndex, itemNum, newItem);
                        }}
                        reorderItems={(itemNum: number, newPosition: number) => {
                            clientReorderChecklist(props.incident.id, selectedChecklistIndex, itemNum, newPosition);
                        }}
                    />
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
