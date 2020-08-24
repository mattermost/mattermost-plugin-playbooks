// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import {useDispatch} from 'react-redux';
import ReactSelect, {ActionMeta, OptionTypeBase, StylesConfig} from 'react-select';
import Scrollbars from 'react-custom-scrollbars';

import {
    fetchUsersInChannel,
    setCommander,
    setActiveStage,
    setChecklistItemState,
} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem, emptyChecklist, ChecklistItemState} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile/profile_selector';

import {isMobile} from 'src/mobile';
import {toggleRHS, endIncident, restartIncident} from 'src/actions';

import 'src/components/checklist.scss';
import './incident_details.scss';
import Duration from './duration';

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
    label: JSX.Element;
}

interface StageSelectorProps {
    stages: Checklist[];
    selectedStage: number;
    activeStage: number;
    onStageSelected: (option: Option, action: ActionMeta<OptionTypeBase>) => void;
    onStageActivated: () => void;
}

const optionStyles: StylesConfig = {
    option: (provided) => {
        return {
            ...provided,
            wordBreak: 'break-word',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        };
    },
};

const StageSelector: FC<StageSelectorProps> = (props: StageSelectorProps) => {
    const isActive = (stageIdx: number) => {
        return stageIdx === props.activeStage;
    };

    const toOption = (stageIdx: number) => {
        return {
            value: stageIdx,
            label: (
                <span>
                    {props.stages[stageIdx].title}
                    {
                        isActive(stageIdx) &&
                        <span className={'badge active'}>
                            {'Active'}
                        </span>
                    }
                </span>
            ),
        };
    };

    return (
        <React.Fragment>
            <div className='title'>
                {'Stages'}
                <span className='stage-title__right'>
                    {
                        !isActive(props.selectedStage) &&
                        <a
                            className='stage-title__set-active'
                            onClick={props.onStageActivated}
                        >
                            {'Make Active'}
                        </a>
                    }
                    <span className='stage-title__count'>
                        {`(${props.selectedStage + 1}/${props.stages.length})`}
                    </span>
                </span>
            </div>
            <ReactSelect
                components={{IndicatorSeparator: null}}
                options={props.stages.map((_, idx) => toOption(idx))}
                value={props.stages.length === 0 ? null : toOption(props.selectedStage)}
                onChange={(option, action) => props.onStageSelected(option as Option, action as ActionMeta<OptionTypeBase>)}
                className={'incident-stage-select'}
                classNamePrefix={'incident-stage-select'}
                styles={optionStyles}
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
    const selectedChecklist = checklists[selectedChecklistIndex] || {title: '', items: []};

    const onStageSelected = (option: Option, action: ActionMeta<OptionTypeBase>) => {
        if (action.action === 'clear') {
            return;
        }

        setSelectedChecklistIndex(option.value);
    };

    const setCurrentStageAsActive = () => {
        setActiveStage(props.incident.id, selectedChecklistIndex);
    };

    let changeStateButton = (
        <button
            className='btn btn-primary'
            onClick={() => dispatch(endIncident())}
        >
            {'End Incident'}
        </button>
    );
    if (!props.incident.is_active) {
        changeStateButton = (
            <button
                className='btn btn-primary'
                onClick={() => dispatch(restartIncident())}
            >
                {'Restart Incident'}
            </button>
        );
    }

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
                    <div className='side-by-side'>
                        <div className='inner-container first-container'>
                            <div className='first-title'>{'Commander'}</div>
                            <ProfileSelector
                                selectedUserId={props.incident.commander_user_id}
                                placeholder={'Assign Commander'}
                                placeholderButtonClass={'NoAssignee-button'}
                                profileButtonClass={'Assigned-button'}
                                enableEdit={true}
                                getUsers={fetchUsers}
                                onSelectedChange={onSelectedProfileChange}
                                withoutProfilePic={true}
                                selfIsFirstOption={true}
                            />
                        </div>
                        <Duration
                            created_at={props.incident.created_at}
                            ended_at={props.incident.ended_at}
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
                                    checklistNum={selectedChecklistIndex}
                                    itemNum={index}
                                    primaryChannelId={props.incident.primary_channel_id}
                                    incidentId={props.incident.id}
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
                {changeStateButton}
            </div>
        </React.Fragment>
    );
};

export default RHSIncidentDetails;
