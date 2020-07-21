// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import Scrollbars from 'react-custom-scrollbars';

import ReactSelect, {ActionMeta, OptionTypeBase} from 'react-select';

import {useDispatch} from 'react-redux';

import {fetchUsersInChannel, setCommander, setActiveStage, setChecklistItemState} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem, emptyChecklist, ChecklistItemState} from 'src/types/playbook';

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

interface StageSelectorProps {
    stages: Checklist[];
    selectedStage: number;
    activeStage: number;
    onStageSelected: (option: Option, action: ActionMeta<OptionTypeBase>) => void;
    onStageActivated: () => void;
}

const StageSelector: FC<StageSelectorProps> = (props: StageSelectorProps) => {
    const isActive = (stageIdx: number) => {
        return stageIdx === props.activeStage;
    };

    const toOption = (stageIdx: number) => {
        return {
            value: stageIdx,
            label: props.stages[stageIdx].title + (isActive(stageIdx) ? ' (Active)' : ''),
        };
    };

    return (
        <React.Fragment>
            <div className='title'>
                {'Stage'}
                { !isActive(props.selectedStage) &&
                    <a
                        onClick={props.onStageActivated}
                        className='stage-title__set-active'
                    >
                        <span className='font-weight--normal'>{'(Set as active stage)'}</span>
                    </a>
                }
            </div>
            <ReactSelect
                options={props.stages.map((_, idx) => toOption(idx))}
                value={toOption(props.selectedStage)}
                defaultValue={toOption(props.selectedStage)}
                onChange={(option, action) => props.onStageSelected(option as Option, action as ActionMeta<OptionTypeBase>)}
                className={'incident-stage-select'}
                classNamePrefix={'incident-stage-select'}
            />
        </React.Fragment>
    );
};

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

    const [selectedChecklistIndex, setSelectedChecklistIndex] = useState(props.incident.active_stage);

    const checklists = props.incident.playbook.checklists || [];
    const selectedChecklist = checklists[selectedChecklistIndex] || emptyChecklist();

    const onStageSelected = (option: Option, action: ActionMeta<OptionTypeBase>) => {
        if (action.action === 'clear') {
            return;
        }

        setSelectedChecklistIndex(option.value);
    };

    const setCurrentStageAsActive = () => {
        setActiveStage(props.incident.id, selectedChecklistIndex);
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
                        <StageSelector
                            stages={checklists}
                            selectedStage={selectedChecklistIndex}
                            activeStage={props.incident.active_stage}
                            onStageSelected={onStageSelected}
                            onStageActivated={setCurrentStageAsActive}
                        />
                    </div>
                    <div
                        className='checklist-inner-container'
                    >
                        <div className='title'>
                            {'Checklist'}
                        </div>
                        <div className='checklist'>
                            {selectedChecklist.items.map((checklistItem: ChecklistItem, index: number) => (
                                <ChecklistItemDetails
                                    key={checklistItem.title + index}
                                    checklistItem={checklistItem}
                                    onChange={(newState: ChecklistItemState) => {
                                        setChecklistItemState(props.incident.id, selectedChecklistIndex, index, newState);
                                    }}
                                    onRedirect={() => {
                                        if (isMobile()) {
                                            dispatch(toggleRHS());
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>
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
