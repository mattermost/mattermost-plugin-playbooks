import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import DotMenu from 'src/components/dot_menu';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {DotMenuIcon, StyledDotMenuButton, StyledDropdownMenu, StyledDropdownMenuItem, DropdownIcon} from 'src/components/checklist/checklist_collapsible_hover_menu';
import {ChecklistItemState} from 'src/types/playbook';

import {
    clientSkipChecklistItem,
    clientRestoreChecklistItem,
    clientRemoveChecklistItem,
    clientDuplicateChecklistItem,
} from 'src/client';

export interface Props {
    playbookRunId: string;
    checklistNum: number;
    itemNum: number;
    isSkipped: boolean;
    isEditing: boolean;
    onEdit: () => void;
    onChange?: (item: ChecklistItemState) => void;
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

const ChecklistItemHoverMenu = (props: Props) => {
    const {formatMessage} = useIntl();
    return (
        <HoverMenu>
            {!props.isEditing &&
                <HoverMenuButton
                    title={formatMessage({defaultMessage: 'Edit'})}
                    className={'icon-pencil-outline icon-16 btn-icon'}
                    onClick={() => {
                        props.onEdit();
                    }}
                />
            }
            {!props.isEditing &&
                <HoverMenuButton
                    title={props.isSkipped ? formatMessage({defaultMessage: 'Restore'}) : formatMessage({defaultMessage: 'Skip'})}
                    className={props.isSkipped ? 'icon-refresh icon-16 btn-icon' : 'icon-close-circle-outline icon-16 btn-icon'}
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
                />
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
                        clientRemoveChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum);
                    }}
                >
                    <DropdownIcon className='icon-trash-can-outline icon-16'/>
                    {formatMessage({defaultMessage: 'Delete task'})}
                </StyledDropdownMenuItem>
            </DotMenu>
        </HoverMenu>
    );
};

export default ChecklistItemHoverMenu;
