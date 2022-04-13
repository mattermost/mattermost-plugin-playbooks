// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

import {addNewTask} from 'src/actions';
import {
    clientSkipChecklist,
    clientRestoreChecklist,
} from 'src/client';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import DotMenu, {DotMenuButton, DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';
import {HoverMenuButton} from 'src/components/rhs/rhs_shared';

export interface Props {
    playbookRunID: string;
    checklistIndex: number;
    checklistTitle: string;
    onRenameChecklist: () => void;
    onDeleteChecklist: () => void;
    dragHandleProps: DraggableProvidedDragHandleProps | undefined;
    isChecklistSkipped: boolean;
}

const CollapsibleChecklistHoverMenu = (props: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    let lastComponent = (
        <Handle
            title={formatMessage({defaultMessage: 'Restore checklist'})}
            className={'icon icon-refresh'}
            onClick={(e) => {
                e.stopPropagation();
                clientRestoreChecklist(props.playbookRunID, props.checklistIndex);
            }}
        />
    );
    if (!props.isChecklistSkipped) {
        lastComponent = (
            <>
                <AddNewTask
                    data-testid={'addNewTask'}
                    onClick={(e) => {
                        e.stopPropagation();
                        dispatch(addNewTask(props.checklistIndex));
                    }}
                >
                    <i className='icon-18 icon-plus'/>
                    {formatMessage({defaultMessage: 'Task'})}
                </AddNewTask>
                <DotMenu
                    icon={<DotMenuIcon/>}
                    dotMenuButton={StyledDotMenuButton}
                    dropdownMenu={StyledDropdownMenu}
                    topPx={15}
                    leftPx={-189}
                    title={formatMessage({defaultMessage: 'More'})}
                >
                    <StyledDropdownMenuItem onClick={props.onRenameChecklist}>
                        <DropdownIcon className='icon-pencil-outline icon-16'/>
                        {formatMessage({defaultMessage: 'Rename checklist'})}
                    </StyledDropdownMenuItem>
                    <StyledDropdownMenuItem onClick={props.onDeleteChecklist}>
                        <DropdownIcon className='icon-trash-can-outline icon-16'/>
                        {formatMessage({defaultMessage: 'Delete checklist'})}
                    </StyledDropdownMenuItem>
                    <StyledDropdownMenuItemRed
                        onClick={() => {
                            clientSkipChecklist(props.playbookRunID, props.checklistIndex);
                        }}
                    >
                        <DropdownIconRed className={'icon-close icon-16'}/>
                        {formatMessage({defaultMessage: 'Skip checklist'})}
                    </StyledDropdownMenuItemRed>
                </DotMenu>
            </>
        );
    }

    return (
        <ButtonRow>
            {props.dragHandleProps &&
                <Handle
                    title={formatMessage({defaultMessage: 'Drag to reorder checklist'})}
                    className={'icon icon-drag-vertical'}
                    {...props.dragHandleProps}
                />
            }
            {lastComponent}
        </ButtonRow>
    );
};

const Handle = styled(HoverMenuButton)`
    border-radius: 4px;
    margin-right: 8px;
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08)
    }
`;

const ButtonRow = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;

    margin-left: auto;
    margin-right: 8px;
`;

const AddNewTask = styled.button`
    margin: 0 8px 0 auto;
    padding: 0 8px 0 0;
    border-radius: 4px;
    border: 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 32px;
    white-space: nowrap;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    background: transparent;

    transition: all 0.15s ease-out;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08)
    }

    &:active {
        background: rgba(var(--center-channel-color-rgb), 0.16);
    }
`;

export const DotMenuIcon = styled(HamburgerButton)`
    font-size: 18px;
`;

export const StyledDotMenuButton = styled(DotMenuButton)`
    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    align-items: center;
    justify-content: center;

    width: 28px;
    height: 28px;
`;

export const StyledDropdownMenu = styled(DropdownMenu)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    padding: 8px 0;
`;

const StyledDropdownMenuItemRed = styled(DropdownMenuItem)`
    padding: 8px 0;
    && {
        color: #D24B4E;
    }
    &&:hover {
        color: #D24B4E;
    }
`;

export const DropdownIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 11px;
`;

const DropdownIconRed = styled.i`
    color: #D24B4E;
    margin-right: 11px;
`;

export default CollapsibleChecklistHoverMenu;
