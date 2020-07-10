// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import Scrollbars from 'react-custom-scrollbars';

import ReactSelect, {ActionTypes} from 'react-select';

import {useDispatch} from 'react-redux';

import {fetchUsersInChannel, setCommander, checkItem, uncheckItem, clientAddChecklistItem, clientRenameChecklistItem, clientRemoveChecklistItem, clientReorderChecklist, setActiveStage} from 'src/client';
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

interface Option {
    value: number;
    label: string;
}

interface ActionObj {
    action: ActionTypes;
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

    const [selectedChecklistIndex, setSelectedChecklistIndex] = useState(0);

    const checklists = props.incident.playbook.checklists || [];
    const defaultChecklist = {title: 'Default Stage', items: []};
    const selectedChecklist = checklists[selectedChecklistIndex] || defaultChecklist;

    if (selectedChecklist.title === '') {
        selectedChecklist.title = defaultChecklist.title;
    }

    const onChecklistChange = (option: Option, action: ActionObj) => {
        if (action.action === 'clear') {
            return;
        }

        setSelectedChecklistIndex(option.value);
    };

    const isActive = (stageIdx: number) => {
        return stageIdx === props.incident.active_stage;
    };

    const setCurrentStageAsActive = () => {
        setActiveStage(props.incident.id, selectedChecklistIndex);
    };

    const stage = (
        <React.Fragment>
            <div className='title'>
                {'Stage '}
                { !isActive(selectedChecklistIndex) &&
                    <a onClick={setCurrentStageAsActive}>
                        <span className='font-weight--normal'>{'(Set as active stage)'}</span>
                    </a>
                }
            </div>
            <ReactSelect
                options={checklists.map((checklist, idx) => {
                    return {value: idx, label: checklist.title + (isActive(idx) ? ' (Active)' : '')};
                })}
                onChange={(option, action) => onChecklistChange(option as Option, action as ActionObj)}
                defaultValue={{value: selectedChecklistIndex, label: selectedChecklist.title}}
                className={'incident-stage-select'}
                classNamePrefix={'incident-stage-select'}
            />
        </React.Fragment>
    );

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
                        {stage}
                    </div>
                    <ChecklistDetails
                        checklist={selectedChecklist}
                        title={'Checklist'}
                        enableEdit={true}
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
                        editItem={(itemNum: number, newTitle: string) => {
                            clientRenameChecklistItem(props.incident.id, selectedChecklistIndex, itemNum, newTitle);
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
