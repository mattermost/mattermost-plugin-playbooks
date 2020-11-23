// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import Scrollbars from 'react-custom-scrollbars';

import {toggleRHS} from 'src/actions';
import {Incident} from 'src/types/incident';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {setChecklistItemState} from 'src/client';
import {ChecklistItemDetails} from 'src/components/checklist_item';
import {isMobile} from 'src/mobile';
import 'src/components/checklist.scss';
import {
    renderThumbHorizontal,
    renderThumbVertical,
    renderView,
} from 'src/components/rhs/rhs_shared';
import Stage from 'src/components/rhs/stage';
import RHSFooterTasks from 'src/components/rhs/rhs_footer_tasks';

const Title = styled.div`
   display: flex;
   align-items: center;
   font-weight: 600;
   padding: 24px 0 8px;
   font-size: 14px;
`;

const InnerContainer = styled.div`
    display: flex;
    flex-direction: column;
`;

interface Props {
    incident: Incident;
}

const RHSIncidentTasks = (props: Props) => {
    const dispatch = useDispatch();

    const checklists = props.incident.checklists || [];
    const activeChecklistIdx = props.incident.active_stage;
    const activeChecklist = checklists[activeChecklistIdx] || {title: '', items: []};

    return (
        <>
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
                    <InnerContainer>
                        <Stage incident={props.incident}/>
                        <Title>
                            {'Tasks'}
                        </Title>
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
                    </InnerContainer>
                </div>
            </Scrollbars>
            <RHSFooterTasks incident={props.incident}/>
        </>
    );
};

export default RHSIncidentTasks;
