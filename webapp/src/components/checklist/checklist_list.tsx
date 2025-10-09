// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {
    DragDropContext,
    Draggable,
    DraggableProvided,
    DraggableStateSnapshot,
    DropResult,
    Droppable,
    DroppableProvided,
} from 'react-beautiful-dnd';

import classNames from 'classnames';

import {FloatingPortal} from '@floating-ui/react-dom-interactions';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {playbookRunUpdated} from 'src/actions';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {
    clientAddChecklist,
    clientMoveChecklist,
    clientMoveChecklistItem,
    updatePlaybookCondition,
} from 'src/client';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {useProxyState} from 'src/hooks';
import {usePlaybookConditions} from 'src/hooks/conditions';
import {PlaybookUpdates} from 'src/graphql/generated/graphql';
import {getDistinctAssignees} from 'src/utils';
import {ConditionExprV1} from 'src/types/conditions';

import CollapsibleChecklist, {ChecklistInputComponent, TitleHelpTextWrapper} from './collapsible_checklist';

import GenericChecklist, {generateKeys} from './generic_checklist';

// disable all react-beautiful-dnd development warnings
// @ts-ignore
window['__react-beautiful-dnd-disable-dev-warnings'] = true;

interface Props {
    playbookRun?: PlaybookRun;
    playbook?: Loaded<FullPlaybook>;
    isReadOnly: boolean;
    checklistsCollapseState: Record<number, boolean>;
    onChecklistCollapsedStateChange: (checklistIndex: number, state: boolean) => void;
    onEveryChecklistCollapsedStateChange: (state: Record<number, boolean>) => void;
    showItem?: (checklistItem: ChecklistItem, myId: string) => boolean;
    itemButtonsFormat?: ItemButtonsFormat;
    onReadOnlyInteract?: () => void;
}

const ChecklistList = ({
    playbookRun,
    playbook: inPlaybook,
    isReadOnly,
    checklistsCollapseState,
    onChecklistCollapsedStateChange,
    onEveryChecklistCollapsedStateChange,
    showItem,
    itemButtonsFormat,
    onReadOnlyInteract,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [newChecklistName, setNewChecklistName] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const updatePlaybook = useUpdatePlaybook(inPlaybook?.id);
    const {conditions, createCondition, refetch: refetchConditions} = usePlaybookConditions(inPlaybook?.id || '');
    const [playbook, setPlaybook] = useProxyState(inPlaybook, useCallback((updatedPlaybook) => {
        const updatedChecklists = updatedPlaybook?.checklists.map((cl) => ({
            ...cl,
            items: cl.items.map((ci) => ({
                title: ci.title,
                description: ci.description,
                state: ci.state,
                stateModified: ci.state_modified || 0,
                assigneeID: ci.assignee_id || '',
                assigneeModified: ci.assignee_modified || 0,
                command: ci.command,
                commandLastRun: ci.command_last_run,
                dueDate: ci.due_date,
                taskActions: ci.task_actions,
                conditionID: ci.condition_id,
            })),
        }));
        const updates: PlaybookUpdates = {
            checklists: updatedChecklists,
        };

        if (updatedPlaybook) {
            const preAssignees = getDistinctAssignees(updatedPlaybook.checklists);
            if (preAssignees.length && !updatedPlaybook.invite_users_enabled) {
                updates.inviteUsersEnabled = true;
            }

            // Append all assignees found in the updated checklists and clear duplicates
            // Only update the invited users when new assignees were added
            const invitedUsers = new Set([...updatedPlaybook.invited_user_ids, ...preAssignees]);
            if (invitedUsers.size > updatedPlaybook.invited_user_ids.length) {
                updates.invitedUserIDs = [...invitedUsers];
            }
        }

        updatePlaybook(updates);
    }, [updatePlaybook]), 0);
    const checklists = playbookRun?.checklists || playbook?.checklists || [];
    const finished = (playbookRun !== undefined) && (playbookRun.current_status === PlaybookRunStatus.Finished);
    const archived = playbook != null && playbook.delete_at !== 0 && !playbookRun;
    const readOnly = finished || archived || isReadOnly;

    if (!playbook && !playbookRun) {
        return null;
    }

    const setChecklistsForPlaybook = (newChecklists: Checklist[]) => {
        if (!playbook) {
            return;
        }

        const updated = newChecklists.map((cl) => {
            return {
                ...cl,
                items: cl.items.map((ci) => {
                    return {
                        ...ci,
                        state_modified: ci.state_modified || 0,
                        assignee_id: ci.assignee_id || '',
                        assignee_modified: ci.assignee_modified || 0,
                    };
                }),
            };
        });

        setPlaybook({...playbook, checklists: updated});
    };

    const onRenameChecklist = (index: number, title: string) => {
        const newChecklists = [...checklists];
        newChecklists[index].title = title;
        setChecklistsForPlaybook(newChecklists);
    };

    const onDuplicateChecklist = (index: number) => {
        const originalChecklist = checklists[index];
        const newChecklist = {
            ...originalChecklist,
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            items: originalChecklist.items.map((item) => ({
                ...item,
                id: `temp_item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            })),
        };
        const newChecklists = [...checklists, newChecklist];
        setChecklistsForPlaybook(newChecklists);
    };

    const onDeleteChecklist = (index: number) => {
        const newChecklists = [...checklists];
        newChecklists.splice(index, 1);
        setChecklistsForPlaybook(newChecklists);
    };

    const onUpdateChecklist = (index: number, newChecklist: Checklist) => {
        const newChecklists = [...checklists];
        newChecklists[index] = {...newChecklist};
        setChecklistsForPlaybook(newChecklists);
    };

    const onDeleteCondition = (conditionId: string) => {
        // Remove condition from all items that reference it
        const newChecklists = checklists.map((checklist) => ({
            ...checklist,
            items: checklist.items.map((item) => ({
                ...item,
                condition_id: item.condition_id === conditionId ? '' : item.condition_id,
            })),
        }));
        setChecklistsForPlaybook(newChecklists);

        // Note: Server-side condition deletion would happen via API call here
        // For now, we just remove the reference from items
    };

    const onCreateCondition = async (checklistIndex: number, itemIndex: number, expr: ConditionExprV1) => {
        try {
            // Create the condition on the server
            const result = await createCondition({
                version: 1,
                condition_expr: expr,
                playbook_id: playbook?.id || '',
            });

            // Refetch conditions to get the latest data
            refetchConditions();

            // Update the item with the new condition_id
            const newChecklists = [...checklists];
            const newItems = [...newChecklists[checklistIndex].items];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                condition_id: result.id,
            };
            newChecklists[checklistIndex] = {
                ...newChecklists[checklistIndex],
                items: newItems,
            };
            setChecklistsForPlaybook(newChecklists);
        } catch (error) {
            console.error('Failed to create condition:', error); // eslint-disable-line no-console
        }
    };

    const onUpdateCondition = async (conditionId: string, expr: ConditionExprV1) => {
        try {
            const existingCondition = conditions.find((c) => c.id === conditionId);
            if (!existingCondition) {
                return;
            }

            // Update the condition on the server
            await updatePlaybookCondition(playbook?.id || '', conditionId, {
                ...existingCondition,
                condition_expr: expr,
            });

            // Refetch conditions to get the latest data
            refetchConditions();
        } catch (error) {
            console.error('Failed to update condition:', error); // eslint-disable-line no-console
        }
    };

    const onDragStart = () => {
        setIsDragging(true);
    };

    const onDragEnd = (result: DropResult) => {
        setIsDragging(false);

        // If the item is dropped out of any droppable zones, do nothing
        if (!result.destination) {
            return;
        }

        const [srcIdx, dstIdx] = [result.source.index, result.destination.index];

        // If the source and desination are the same, do nothing
        if (result.destination.droppableId === result.source.droppableId && srcIdx === dstIdx) {
            return;
        }

        // Copy the data to modify it
        const newChecklists = [...checklists];

        // Move a checklist item, either inside of the same checklist, or between checklists
        if (result.type === 'checklist-item') {
            // Parse droppableIds to detect conditional groups
            // Format: "condition-{conditionId}-checklist-{checklistIdx}" or just "{checklistIdx}"
            const parseDroppableId = (droppableId: string): {checklistIdx: number; conditionId?: string} => {
                const conditionMatch = droppableId.match(/^condition-(.+)-checklist-(\d+)$/);
                if (conditionMatch) {
                    return {
                        conditionId: conditionMatch[1],
                        checklistIdx: parseInt(conditionMatch[2], 10),
                    };
                }
                return {checklistIdx: parseInt(droppableId, 10)};
            };

            const src = parseDroppableId(result.source.droppableId);
            const dst = parseDroppableId(result.destination.droppableId);

            // Helper to get the actual flat array index from a conditional group index
            const getFlatIndex = (checklistIdx: number, conditionId: string | undefined, groupIndex: number): number => {
                if (!conditionId) {
                    // Not in a conditional group - find the nth item without a condition_id
                    const items = checklists[checklistIdx].items;
                    let count = 0;
                    for (let i = 0; i < items.length; i++) {
                        if (!items[i].condition_id) {
                            if (count === groupIndex) {
                                return i;
                            }
                            count++;
                        }
                    }
                    return -1;
                }

                // In a conditional group - find the nth item with this condition_id
                const items = checklists[checklistIdx].items;
                let count = 0;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].condition_id === conditionId) {
                        if (count === groupIndex) {
                            return i;
                        }
                        count++;
                    }
                }
                return -1;
            };

            // Helper to calculate where to insert in the flat array
            const calculateInsertionIndex = (checklistIdx: number, conditionId: string | undefined, groupIndex: number, items: ChecklistItem[]): number => {
                if (!conditionId) {
                    // Inserting into main area (no condition)
                    // Find the position of the nth non-conditional item
                    let count = 0;
                    for (let i = 0; i < items.length; i++) {
                        if (!items[i].condition_id) {
                            if (count === groupIndex) {
                                return i;
                            }
                            count++;
                        }
                    }

                    // If we're inserting at the end, return the length
                    return items.length;
                }

                // Inserting into a conditional group
                // Find the position of the nth item with this condition_id
                let count = 0;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].condition_id === conditionId) {
                        if (count === groupIndex) {
                            return i;
                        }
                        count++;
                    }
                }

                // If we're inserting at the end of the group, find the position after the last item
                // in this condition group
                for (let i = items.length - 1; i >= 0; i--) {
                    if (items[i].condition_id === conditionId) {
                        return i + 1;
                    }
                }

                // Group doesn't exist yet - this shouldn't happen
                return items.length;
            };

            if (src.checklistIdx === dst.checklistIdx) {
                // Moving within the same checklist
                const newChecklistItems = [...checklists[src.checklistIdx].items];

                // Get actual indices in the flat array
                const actualSrcIdx = getFlatIndex(src.checklistIdx, src.conditionId, srcIdx);
                if (actualSrcIdx === -1) {
                    return;
                }

                // Remove the item
                const [removed] = newChecklistItems.splice(actualSrcIdx, 1);

                // Update condition_id if moving between groups
                const updatedItem = dst.conditionId === src.conditionId ? removed : {...removed, condition_id: dst.conditionId || ''};

                // Calculate where to insert (after removal, so indices may have shifted)
                const actualDstIdx = calculateInsertionIndex(dst.checklistIdx, dst.conditionId, dstIdx, newChecklistItems);

                // Insert the item
                newChecklistItems.splice(actualDstIdx, 0, updatedItem);

                newChecklists[src.checklistIdx] = {
                    ...newChecklists[src.checklistIdx],
                    items: newChecklistItems,
                };
            } else {
                // Moving between different checklists
                const srcChecklist = checklists[src.checklistIdx];
                const dstChecklist = checklists[dst.checklistIdx];

                // Get actual source index
                const actualSrcIdx = getFlatIndex(src.checklistIdx, src.conditionId, srcIdx);
                if (actualSrcIdx === -1) {
                    return;
                }

                // Remove from source
                const newSrcChecklistItems = [...srcChecklist.items];
                const [moved] = newSrcChecklistItems.splice(actualSrcIdx, 1);

                // Update condition_id if moving between groups
                const updatedItem = dst.conditionId === src.conditionId ? moved : {...moved, condition_id: dst.conditionId || ''};

                // Calculate destination index
                const newDstChecklistItems = [...dstChecklist.items];
                const actualDstIdx = calculateInsertionIndex(dst.checklistIdx, dst.conditionId, dstIdx, newDstChecklistItems);

                // Insert into destination
                newDstChecklistItems.splice(actualDstIdx, 0, updatedItem);

                // Update both checklists
                newChecklists[src.checklistIdx] = {
                    ...srcChecklist,
                    items: newSrcChecklistItems,
                };
                newChecklists[dst.checklistIdx] = {
                    ...dstChecklist,
                    items: newDstChecklistItems,
                };
            }

            // Persist the new data in the server
            if (playbookRun) {
                clientMoveChecklistItem(playbookRun.id, src.checklistIdx, srcIdx, dst.checklistIdx, dstIdx);
            }
        }

        // Move a whole checklist
        if (result.type === 'checklist') {
            const [moved] = newChecklists.splice(srcIdx, 1);
            newChecklists.splice(dstIdx, 0, moved);

            if (playbookRun) {
                // The collapsed state of a checklist in the store is linked to the index in the list,
                // so we need to shift all indices between srcIdx and dstIdx to the left (or to the
                // right, depending on whether srcIdx < dstIdx) one position
                const newState = {...checklistsCollapseState};
                if (srcIdx < dstIdx) {
                    for (let i = srcIdx; i < dstIdx; i++) {
                        newState[i] = checklistsCollapseState[i + 1];
                    }
                } else {
                    for (let i = dstIdx + 1; i <= srcIdx; i++) {
                        newState[i] = checklistsCollapseState[i - 1];
                    }
                }
                newState[dstIdx] = checklistsCollapseState[srcIdx];

                onEveryChecklistCollapsedStateChange(newState);

                // Persist the new data in the server
                clientMoveChecklist(playbookRun.id, srcIdx, dstIdx);
            }
        }

        // Update the store with the new checklists
        if (playbookRun) {
            dispatch(playbookRunUpdated({
                ...playbookRun,
                checklists: newChecklists,
            }));
        } else {
            setChecklistsForPlaybook(newChecklists);
        }
    };

    let addChecklist = (
        <AddChecklistLink
            disabled={archived}
            onClick={(e) => {
                e.stopPropagation();
                setAddingChecklist(true);
            }}
            data-testid={'add-a-checklist-button'}
        >
            <IconWrapper>
                <i className='icon icon-plus'/>
            </IconWrapper>
            {formatMessage({defaultMessage: 'Add a checklist'})}
        </AddChecklistLink>
    );

    if (addingChecklist) {
        addChecklist = (
            <NewChecklist>
                <Icon className={'icon-chevron-down'}/>
                <ChecklistInputComponent
                    title={newChecklistName}
                    setTitle={setNewChecklistName}
                    onCancel={() => {
                        setAddingChecklist(false);
                        setNewChecklistName('');
                    }}
                    onSave={() => {
                        if (playbookRun) {
                            const newChecklist: Omit<Checklist, 'id'> = {title: newChecklistName, items: [] as ChecklistItem[]};
                            clientAddChecklist(playbookRun.id, newChecklist);
                        } else {
                            const newChecklist: Checklist = {
                                title: newChecklistName,
                                items: [] as ChecklistItem[],
                            };
                            setChecklistsForPlaybook([...checklists, newChecklist]);
                        }
                        setTimeout(() => setNewChecklistName(''), 300);
                        setAddingChecklist(false);
                    }}
                />
            </NewChecklist>
        );
    }

    const keys = generateKeys(checklists.map((checklist, index) => checklist.title + index));

    return (
        <>
            <DragDropContext
                onDragEnd={onDragEnd}
                onDragStart={onDragStart}
            >
                <Droppable
                    droppableId={'all-checklists'}
                    direction={'vertical'}
                    type={'checklist'}
                >
                    {(droppableProvided: DroppableProvided) => (
                        <ChecklistsContainer
                            {...droppableProvided.droppableProps}
                            className={classNames('checklists', {isDragging})}
                            ref={droppableProvided.innerRef}
                        >
                            {checklists.map((checklist: Checklist, checklistIndex: number) => (
                                <Draggable
                                    key={keys[checklistIndex]}
                                    draggableId={checklist.title + checklistIndex}
                                    index={checklistIndex}
                                >
                                    {(draggableProvided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
                                        const component = (
                                            <CollapsibleChecklist
                                                draggableProvided={draggableProvided}
                                                title={checklist.title}
                                                items={checklist.items}
                                                index={checklistIndex}
                                                collapsed={Boolean(checklistsCollapseState[checklistIndex])}
                                                setCollapsed={(newState) => onChecklistCollapsedStateChange(checklistIndex, newState)}
                                                disabled={readOnly}
                                                playbookRunID={playbookRun?.id}
                                                onRenameChecklist={onRenameChecklist}
                                                onDuplicateChecklist={onDuplicateChecklist}
                                                onDeleteChecklist={onDeleteChecklist}
                                                titleHelpText={playbook ? (
                                                    <TitleHelpTextWrapper>
                                                        {formatMessage(
                                                            {defaultMessage: '{numTasks, number} {numTasks, plural, one {task} other {tasks}}'},
                                                            {numTasks: checklist.items.length},
                                                        )}
                                                    </TitleHelpTextWrapper>
                                                ) : undefined}
                                            >
                                                <GenericChecklist
                                                    id={playbookRun?.id || ''}
                                                    playbookRun={playbookRun}
                                                    playbookId={playbook?.id || playbookRun?.playbook_id || ''}
                                                    readOnly={readOnly}
                                                    checklist={checklist}
                                                    checklistIndex={checklistIndex}
                                                    onUpdateChecklist={(newChecklist: Checklist) => onUpdateChecklist(checklistIndex, newChecklist)}
                                                    showItem={showItem}
                                                    itemButtonsFormat={itemButtonsFormat}
                                                    onReadOnlyInteract={onReadOnlyInteract}
                                                    conditions={conditions}
                                                    propertyFields={playbook?.propertyFields.map((pf) => ({
                                                        id: pf.id,
                                                        name: pf.name,
                                                        type: pf.type,
                                                        group_id: pf.group_id,
                                                        create_at: pf.create_at,
                                                        update_at: pf.update_at,
                                                        delete_at: pf.delete_at,
                                                        target_type: 'playbook' as const,
                                                        attrs: {
                                                            visibility: pf.attrs.visibility as any,
                                                            sort_order: pf.attrs.sort_order,
                                                            options: pf.attrs.options as any,
                                                            parent_id: pf.attrs.parent_id || undefined,
                                                        },
                                                    })) || []}
                                                    onDeleteCondition={onDeleteCondition}
                                                    onCreateCondition={(expr, itemIndex) => onCreateCondition(checklistIndex, itemIndex, expr)}
                                                    onUpdateCondition={onUpdateCondition}
                                                />
                                            </CollapsibleChecklist>
                                        );

                                        if (snapshot.isDragging) {
                                            return <FloatingPortal>{component}</FloatingPortal>;
                                        }

                                        return component;
                                    }}
                                </Draggable>
                            ))}
                            {droppableProvided.placeholder}
                        </ChecklistsContainer>
                    )}
                </Droppable>
                {!readOnly && addChecklist}
            </DragDropContext>
        </>
    );
};

const AddChecklistLink = styled.button`
    display: flex;
    width: 100%;
    height: 44px;
    flex-direction: row;
    align-items: center;
    border: 1px dashed;
    border-color: var(--center-channel-color-16);
    border-radius: 4px;
    background: none;
    color: var(--center-channel-color-64);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;

    &:hover:not(:disabled) {
        background-color: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

const NewChecklist = styled.div`
    position: sticky;
    z-index: 1;
    top: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    border-radius: 4px 4px 0 0;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 18px;
`;

const ChecklistsContainer = styled.div`/* stylelint-disable no-empty-source */`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

export default ChecklistList;
