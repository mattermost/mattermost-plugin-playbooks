// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {Checklist, ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import {endIncident, nextStage, prevStage, restartIncident} from 'src/actions';
import {Incident} from 'src/types/incident';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';

interface NextStageButtonProps {
    stages: Checklist[];
    activeStage: number;
    isActive: boolean;
    endIncident: () => void;
    restartIncident: () => void;
    nextStage: () => void;
}

const BasicButton = styled.button`
    display: block;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
`;

interface BasicButtonProps {
    primary: boolean;
}

const StyledButton = styled(BasicButton)<BasicButtonProps>`
    min-width: 114px;
    height: 40px;
    ${(props: BasicButtonProps) => props.primary && css`
        background: var(--button-bg);
        color: var(--button-color);
    `}`;

const NextStageButton: FC<NextStageButtonProps> = (props: NextStageButtonProps) => {
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
        <StyledButton
            primary={primary}
            onClick={action}
        >
            {text}
        </StyledButton>
    );
};

const Footer = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    button:only-child {
        margin-left: auto;
    }

    background: var(--center-channel-bg);
    border-top: 1px solid var(--center-channel-color-16);
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: auto;
    text-align: right;
    padding: 2rem;

    a {
        opacity: unset;
    }
`;

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
            icon={<HamburgerButton/>}
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
