import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {DotMenuIcon, StyledDotMenuButton, StyledDropdownMenu, StyledDropdownMenuItem, DropdownIcon} from 'src/components/collapsible_checklist_hover_menu';
import DotMenu from 'src/components/dot_menu';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {ChecklistItemState} from 'src/types/playbook';

import {
    clientSkipChecklistItem,
    clientRestoreChecklistItem,
    clientDuplicateChecklistItem,
} from 'src/client';

import AssignTo from './assign_to';

export interface Props {
    playbookRunId: string;
    checklistNum: number;
    itemNum: number;
    isSkipped: boolean;
    isEditing: boolean;
    onEdit: () => void;
    onChange?: (item: ChecklistItemState) => void;
    description: string;
    showDescription: boolean;
    toggleDescription: () => void;
    assignee_id: string;
}

const HoverMenu = styled.div`
    display: flex;
    padding: 4px;
    position: absolute;
    right: 0;
    top: -8px;
    box-shadow: none;
    background: none;
    border: none;
`;

const ToggleDescriptionButton = styled(HoverMenuButton) <{showDescription: boolean}>`
    transition: all 0.2s linear;
    transform: ${({showDescription}) => (showDescription ? 'rotate(0deg)' : 'rotate(180deg)')};
`;

const ChecklistItemHoverMenu = (props: Props) => {
    const {formatMessage} = useIntl();
    return (
        <HoverMenu>
            {!props.isEditing &&
                <>
                    {props.description !== '' &&
                        <ToggleDescriptionButton
                            title={formatMessage({defaultMessage: 'Toggle description'})}
                            className={'icon icon-chevron-up'}
                            showDescription={props.showDescription}
                            onClick={props.toggleDescription}
                        />
                    }
                    <AssignTo
                        assignee_id={props.assignee_id}
                        checklistNum={props.checklistNum}
                        itemNum={props.itemNum}
                        playbookRunId={props.playbookRunId}
                        editable={props.isEditing}
                        withoutName={false}
                        inHoverMenu={true}
                    />
                    <HoverMenuButton
                        title={formatMessage({defaultMessage: 'Edit'})}
                        className={'icon-pencil-outline icon-16 btn-icon'}
                        onClick={() => {
                            props.onEdit();
                        }}
                    />
                </>
            }
            <DotMenu
                icon={<DotMenuIcon/>}
                dotMenuButton={StyledDotMenuButton}
                dropdownMenu={StyledDropdownMenu}
                topPx={15}
                leftPx={-189}
                title={formatMessage({defaultMessage: 'More'})}
            >
                <StyledDropdownMenuItem
                    onClick={() => {
                        clientDuplicateChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                    }}
                >
                    <DropdownIcon className='icon-content-copy icon-16'/>
                    {formatMessage({defaultMessage: 'Duplicate task'})}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    onClick={() => {
                        if (props.isSkipped) {
                            clientRestoreChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                            if (props.onChange) {
                                props.onChange(ChecklistItemState.Open);
                            }
                        } else {
                            clientSkipChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                            if (props.onChange) {
                                props.onChange(ChecklistItemState.Skip);
                            }
                        }
                    }}
                >
                    <DropdownIcon className={props.isSkipped ? 'icon-refresh icon-16 btn-icon' : 'icon-close icon-16 btn-icon'}/>
                    {props.isSkipped ? formatMessage({defaultMessage: 'Restore task'}) : formatMessage({defaultMessage: 'Skip task'})}
                </StyledDropdownMenuItem>
            </DotMenu>
        </HoverMenu>
    );
};

export default ChecklistItemHoverMenu;
