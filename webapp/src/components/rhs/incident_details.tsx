// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import {useDispatch} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';

import {
    fetchUsersInChannel,
    setCommander,
    setActiveStage,
    setChecklistItemState,
} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {Incident} from 'src/types/incident';
import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';

import ProfileSelector from 'src/components/profile/profile_selector';

import {isMobile} from 'src/mobile';
import {toggleRHS, endIncident, restartIncident, nextStage} from 'src/actions';

import Duration from '../duration';

import 'src/components/checklist.scss';
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

interface StageProps {
    stages: Checklist[];
    activeStage: number;
}

const Stage: FC<StageProps> = (props: StageProps) => {
    return (
        <React.Fragment>
            <div className='title'>
                {'Current Stage:'}
            </div>
            <div>
                <span className='stage-title__right'>
                    {props.stages[props.activeStage].title}
                    <span className='stage-title__count'>
                        {`(${props.activeStage + 1}/${props.stages.length})`}
                    </span>
                </span>
            </div>
        </React.Fragment>
    );
};

interface NextStageButtonProps {
    stages: Checklist[];
    activeStage: number;
    isActive: boolean;
    endIncident: () => void;
    restartIncident: () => void;
    nextStage: () => void;
}

const NextStageButton: FC<NextStageButtonProps> = (props: NextStageButtonProps) => {
    let text = 'Next Stage'
    let action = props.nextStage;

    if (!props.isActive) {
        text = 'Restart Incident'
        action = props.restartIncident;
    }

    if (props.activeStage === props.stages.length - 1) {
        text = 'End Incident'
        action = props.endIncident;
    }

    let classes = 'btn btn-primary';

    const allItemsChecked = props.stages[props.activeStage].items.every(
        (item: ChecklistItem) => item.state === ChecklistItemState.Closed
    );

    if (props.isActive && !allItemsChecked) {
        classes = 'btn';
    }

    return (
        <button
            className={classes}
            onClick={action}
        >
            {text}
        </button>
    );
}

const RHSIncidentDetails: FC<Props> = (props: Props) => {
    const dispatch = useDispatch();

    const fetchUsers = async () => {
        return fetchUsersInChannel(props.incident.channel_id);
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

    const checklists = props.incident.checklists || [];
    const activeChecklistIdx = props.incident.active_stage
    const activeChecklist = checklists[activeChecklistIdx] || {title: '', items: []};

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
                                selfIsFirstOption={true}
                            />
                        </div>
                        <Duration
                            created_at={props.incident.create_at}
                            ended_at={props.incident.end_at}
                        />
                    </div>
                    <div className='inner-container'>
                        <Stage
                            stages={checklists}
                            activeStage={activeChecklistIdx}
                        />
                    </div>
                    <div
                        className='checklist-inner-container'
                    >
                        <div className='title'>
                            {'Checklist'}
                        </div>
                        <div className='checklist'>
                            {activeChecklist.items.map((checklistItem: ChecklistItem, index: number) => (
                                <ChecklistItemDetails
                                    key={checklistItem.title + index}
                                    checklistItem={checklistItem}
                                    checklistNum={activeChecklistIdx}
                                    itemNum={index}
                                    channelId={props.incident.channel_id}
                                    incidentId={props.incident.id}
                                    onChange={(newState: ChecklistItemState) => {
                                        setChecklistItemState(props.incident.id, activeChecklistIdx, index, newState);
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
                <NextStageButton
                    stages={checklists}
                    activeStage={activeChecklistIdx}
                    isActive={props.incident.is_active}
                    endIncident={() => dispatch(endIncident())}
                    restartIncident={() => dispatch(restartIncident())}
                    nextStage={() => dispatch(nextStage())}
                />
            </div>
        </React.Fragment>
    );
};

export default RHSIncidentDetails;
