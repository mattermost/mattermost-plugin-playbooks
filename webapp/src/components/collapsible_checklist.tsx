// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import {Draggable, DraggableProvided, DraggableStateSnapshot, DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

import {FormattedMessage, useIntl} from 'react-intl';

import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';
import HoverMenu from 'src/components/collapsible_checklist_hover_menu';
import RenameChecklistDialog from 'src/components/rhs/rhs_checklists_rename_dialog';
import DeleteChecklistDialog from 'src/components/rhs/rhs_checklists_delete_dialog';

export interface Props {
    title: string;
    index: number;
    numChecklists: number;
    collapsed: boolean;
    setCollapsed: (newState: boolean) => void;
    items: ChecklistItem[];
    children: React.ReactNode;
    disabledOrRunID: true | string;
    titleHelpText?: React.ReactNode;
    draggableProvided?: DraggableProvided;
}

const CollapsibleChecklist = ({
    title,
    index,
    numChecklists,
    collapsed,
    setCollapsed,
    items,
    children,
    disabledOrRunID,
    titleHelpText,
    draggableProvided,
}: Props) => {
    const titleRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const icon = collapsed ? 'icon-chevron-right' : 'icon-chevron-down';
    const [completed, total] = tasksCompleted(items);
    const percentage = total === 0 ? 0 : (completed / total) * 100;

    const disabled = typeof disabledOrRunID !== 'string';
    const playbookRunID = typeof disabledOrRunID === 'string' ? disabledOrRunID : '';

    let borderProps = {};
    if (draggableProvided) {
        borderProps = {
            ...draggableProvided.draggableProps,
            ref: draggableProvided.innerRef,
        };
    }
    return (
        <Border {...borderProps}>
            <HorizontalBG
                checklistIndex={index}
                numChecklists={numChecklists}
            >
                <Horizontal
                    data-testid={'checklistHeader'}
                    onClick={() => setCollapsed(!collapsed)}
                    onMouseEnter={() => setShowMenu(true)}
                    onMouseLeave={() => setShowMenu(false)}
                >
                    <Icon className={icon}/>
                    <Title ref={titleRef}>
                        <TextWithTooltipWhenEllipsis
                            id={index.toString(10)}
                            text={title}
                            parentRef={titleRef}
                        />
                    </Title>
                    {titleHelpText || (
                        <TitleHelpTextWrapper>
                            <FormattedMessage
                                defaultMessage='{completed, number} / {total, number} done'
                                values={{completed, total}}
                            />
                        </TitleHelpTextWrapper>
                    )}
                    {
                        showMenu && !disabled &&
                        <HoverMenu
                            playbookRunID={playbookRunID}
                            checklistIndex={index}
                            checklistTitle={title}
                            onRenameChecklist={() => setShowRenameDialog(true)}
                            onDeleteChecklist={() => setShowDeleteDialog(true)}
                            dragHandleProps={draggableProvided?.dragHandleProps}
                        />
                    }
                </Horizontal>
                <ProgressBackground>
                    <ProgressLine width={percentage}/>
                </ProgressBackground>
            </HorizontalBG>
            {!collapsed && children}
            <RenameChecklistDialog
                playbookRunID={playbookRunID}
                checklistNumber={index}
                show={showRenameDialog}
                onHide={() => setShowRenameDialog(false)}
                initialTitle={title}
            />
            <DeleteChecklistDialog
                playbookRunID={playbookRunID}
                checklistIndex={index}
                show={showDeleteDialog}
                onHide={() => setShowDeleteDialog(false)}
            />
        </Border>
    );
};

const Border = styled.div`
    margin-bottom: 12px;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

const ProgressBackground = styled.div`
    position: relative;

    &:after {
        border-bottom: 2px solid rgba(var(--center-channel-color-rgb), 0.08);
        content: '';
        display: block;
        width: 100%;
    }
`;

const ProgressLine = styled.div<{ width: number }>`
    position: absolute;
    width: 100%;

    &:after {
        border-bottom: 2px solid var(--online-indicator);
        content: '';
        display: block;
        width: ${(props) => props.width}%;
    }
`;

export const HorizontalBG = styled.div<{checklistIndex: number, numChecklists: number}>`
    background-color: var(--center-channel-bg);
    z-index: ${({checklistIndex, numChecklists}) => 1 + (numChecklists - checklistIndex)};
    position: sticky;
    top: 48px; // height of rhs_checklists MainTitle
`;

const Horizontal = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px 4px 0 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    display: flex;
    flex-direction: row;
    align-items: baseline;
    cursor: pointer;
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;

    font-size: 18px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
`;

const Title = styled.div`
    margin: 0 6px 0 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 44px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.80);
    }
`;

export const TitleHelpTextWrapper = styled.div`
    margin-right: 16px;

    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
    color: rgba(var(--center-channel-color-rgb), 0.48);

    ${Horizontal}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const tasksCompleted = (items: ChecklistItem[]) => {
    let completed = 0;
    let total = 0;

    for (const item of items) {
        if (item.state !== ChecklistItemState.Skip) {
            total++;
        }
        if (item.state === ChecklistItemState.Closed) {
            completed++;
        }
    }

    return [completed, total];
};

export default CollapsibleChecklist;

