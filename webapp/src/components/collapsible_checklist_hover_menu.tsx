// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

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
}

const CollapsibleChecklistHoverMenu = (props: Props) => {
    const {formatMessage} = useIntl();

    return (
        <ButtonRow>
            {props.dragHandleProps &&
            <Handle
                title={formatMessage({defaultMessage: 'Drag to reorder checklist'})}
                className={'icon icon-drag-vertical'}
                {...props.dragHandleProps}
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
                <StyledDropdownMenuItem onClick={props.onRenameChecklist}>
                    <DropdownIcon className='icon-pencil-outline icon-16'/>
                    {formatMessage({defaultMessage: 'Rename checklist'})}
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem onClick={props.onDeleteChecklist}>
                    <DropdownIcon className='icon-trash-can-outline icon-16'/>
                    {formatMessage({defaultMessage: 'Delete checklist'})}
                </StyledDropdownMenuItem>
            </DotMenu>
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

export const DropdownIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-right: 11px;
`;

export default CollapsibleChecklistHoverMenu;
