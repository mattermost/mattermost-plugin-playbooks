// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import {isCurrentChannelArchived} from 'mattermost-redux/selectors/entities/channels';

import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {endIncident, nextStage, prevStage, restartIncident} from 'src/actions';
import {Incident} from 'src/types/incident';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';

interface NextStageButtonProps {
    stages: Checklist[];
    activeStage: number;
    isActive: boolean;
    endIncident: () => void;
    restartIncident: () => void;
    nextStage: () => void;
}

const NextStageButton: FC<NextStageButtonProps> = (props: NextStageButtonProps) => {
    const isChannelArchived = useSelector<GlobalState, boolean>(isCurrentChannelArchived);
    if (isChannelArchived) {
        return null;
    }

    let text;
    let action;
    let primary;

    if (!props.isActive) {
        text = 'Restart Incident';
        action = props.restartIncident;
        primary = true;
    } else if (props.stages.length === 0) {
        text = 'End Incident';
        action = props.endIncident;
        primary = true;
    } else {
        if (props.activeStage === props.stages.length - 1) {
            text = 'End Incident';
            action = props.endIncident;
        } else {
            text = 'Next Stage';
            action = props.nextStage;
        }

        primary = props.stages[props.activeStage].items.every((item: ChecklistItem) => (
            item.state === ChecklistItemState.Closed
        ));
    }

    return (
        <StyledFooterButton
            primary={primary}
            onClick={action}
        >
            {text}
        </StyledFooterButton>
    );
};

interface Props {
    incident: Incident;
}

const RHSFooterTasks = (props: Props) => {
    const dispatch = useDispatch();
    const checklists = props.incident.checklists || [];
    const activeChecklistIdx = props.incident.active_stage;

    const dotMenuChildren = [];
    if (props.incident.active_stage > 0) {
        dotMenuChildren.push(
            <DropdownMenuItem
                key='previous'
                text='Previous Stage'
                onClick={() => dispatch(prevStage())}
            />,
        );
    }

    if (props.incident.active_stage < props.incident.checklists.length - 1) {
        dotMenuChildren.push(
            <DropdownMenuItem
                key='end'
                text='End Incident'
                onClick={() => dispatch(endIncident())}
            />,
        );
    }

    const dotMenu = (
        <DotMenu
            icon={<HamburgerButton />}
            top={true}
        >
            {dotMenuChildren}
        </DotMenu>
    );

    return (
        <Footer id='incidentRHSFooter'>
            {checklists.length > 1 && dotMenu}
            <NextStageButton
                stages={checklists}
                activeStage={activeChecklistIdx}
                isActive={props.incident.is_active}
                endIncident={() => dispatch(endIncident())}
                restartIncident={() => dispatch(restartIncident())}
                nextStage={() => dispatch(nextStage())}
            />
        </Footer>
    );
};

export default RHSFooterTasks;
