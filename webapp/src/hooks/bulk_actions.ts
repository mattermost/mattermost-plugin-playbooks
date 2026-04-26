// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {AnyAction} from 'redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {Checklist, ChecklistItem} from 'src/types/playbook';
import {clientDeleteChecklistItem, setDueDate as clientSetDueDate, setAssignee} from 'src/client';
import {playbookRunUpdated} from 'src/actions';
import {ToastStyle} from 'src/components/backstage/toast';
import {useToaster} from 'src/components/backstage/toast_banner';
import {FullPlaybook, Loaded} from 'src/graphql/hooks';

type SelectedItem = {checklistIndex: number; itemIndex: number; item: ChecklistItem};

interface UseBulkActionsArgs {
    playbookRun?: PlaybookRun;
    playbook?: Loaded<FullPlaybook>;
    checklists: Checklist[];
    setChecklistsForPlaybook: (checklists: Checklist[]) => void;
    bulkEditMode?: boolean;
    onExitBulkEdit?: () => void;
}

export const useBulkActions = ({
    playbookRun,
    playbook,
    checklists,
    setChecklistsForPlaybook,
    bulkEditMode,
    onExitBulkEdit,
}: UseBulkActionsArgs) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

    const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());

    // Clear selections when exiting bulk edit mode
    useEffect(() => {
        if (!bulkEditMode) {
            setSelectedItems(new Map());
        }
    }, [bulkEditMode]);

    const onItemSelect = useCallback((key: string, checklistIndex: number, itemIndex: number, item: ChecklistItem) => {
        setSelectedItems((prev: Map<string, SelectedItem>) => {
            const next = new Map(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.set(key, {checklistIndex, itemIndex, item});
            }
            return next;
        });
    }, []);

    const selectedIndices = useMemo(() => {
        const indices = new Set<string>();
        selectedItems.forEach(({checklistIndex, itemIndex}) => {
            indices.add(`${checklistIndex}-${itemIndex}`);
        });
        return indices;
    }, [selectedItems]);

    const selectedItemKeysSet = useMemo(() => new Set(selectedItems.keys()), [selectedItems]);

    const isSelectedIndex = (clIdx: number, itemIdx: number) => {
        return selectedIndices.has(`${clIdx}-${itemIdx}`);
    };

    const handleBulkAssign = async (userId: string) => {
        if (playbookRun) {
            const selectedEntries = [...selectedItems.values()];
            const results = await Promise.allSettled(
                selectedEntries.map(({checklistIndex, itemIndex}) =>
                    setAssignee(playbookRun.id, checklistIndex, itemIndex, userId),
                ),
            );

            // Track which items succeeded — setAssignee returns {error} on failure
            // instead of rejecting, so check both rejected and fulfilled-with-error
            const succeeded = new Set<string>();
            let failureCount = 0;
            results.forEach((r, i) => {
                const failed = r.status === 'rejected' ||
                    (r.status === 'fulfilled' && r.value?.error);
                if (failed) {
                    failureCount++;
                } else {
                    const {checklistIndex, itemIndex} = selectedEntries[i];
                    succeeded.add(`${checklistIndex}-${itemIndex}`);
                }
            });
            if (failureCount > 0) {
                addToast({
                    content: formatMessage(
                        {defaultMessage: 'Failed to assign {count} of {total} tasks'},
                        {count: failureCount, total: results.length},
                    ),
                    toastStyle: ToastStyle.Failure,
                });
            }

            // Only update items that succeeded
            const newChecklists = checklists.map((cl, clIdx) => ({
                ...cl,
                items: cl.items.map((item, itemIdx) => {
                    if (succeeded.has(`${clIdx}-${itemIdx}`)) {
                        return {...item, assignee_id: userId};
                    }
                    return item;
                }),
            }));
            dispatch(playbookRunUpdated({...playbookRun, checklists: newChecklists}) as AnyAction);
        } else if (playbook) {
            const newChecklists = checklists.map((cl, clIdx) => ({
                ...cl,
                items: cl.items.map((item, itemIdx) => {
                    if (isSelectedIndex(clIdx, itemIdx)) {
                        return {...item, assignee_id: userId};
                    }
                    return item;
                }),
            }));
            setChecklistsForPlaybook(newChecklists);
        }
    };

    const handleBulkDueDate = async (timestamp: number) => {
        if (playbookRun) {
            const selectedEntries = [...selectedItems.values()];
            const results = await Promise.allSettled(
                selectedEntries.map(({checklistIndex, itemIndex}) =>
                    clientSetDueDate(playbookRun.id, checklistIndex, itemIndex, timestamp),
                ),
            );

            // Track which items succeeded — clientSetDueDate returns {error} on
            // failure instead of rejecting
            const succeeded = new Set<string>();
            let failureCount = 0;
            results.forEach((r, i) => {
                const failed = r.status === 'rejected' ||
                    (r.status === 'fulfilled' && r.value?.error);
                if (failed) {
                    failureCount++;
                } else {
                    const {checklistIndex, itemIndex} = selectedEntries[i];
                    succeeded.add(`${checklistIndex}-${itemIndex}`);
                }
            });
            if (failureCount > 0) {
                addToast({
                    content: formatMessage(
                        {defaultMessage: 'Failed to update due date for {count} of {total} tasks'},
                        {count: failureCount, total: results.length},
                    ),
                    toastStyle: ToastStyle.Failure,
                });
            }

            // Only update items that succeeded
            const newChecklists = checklists.map((cl, clIdx) => ({
                ...cl,
                items: cl.items.map((item, itemIdx) => {
                    if (succeeded.has(`${clIdx}-${itemIdx}`)) {
                        return {...item, due_date: timestamp};
                    }
                    return item;
                }),
            }));
            dispatch(playbookRunUpdated({...playbookRun, checklists: newChecklists}) as AnyAction);
        } else if (playbook) {
            const newChecklists = checklists.map((cl, clIdx) => ({
                ...cl,
                items: cl.items.map((item, itemIdx) => {
                    if (isSelectedIndex(clIdx, itemIdx)) {
                        return {...item, due_date: timestamp};
                    }
                    return item;
                }),
            }));
            setChecklistsForPlaybook(newChecklists);
        }
    };

    const handleBulkDelete = async () => {
        const selectedByChecklist = new Map<number, Set<number>>();
        selectedItems.forEach(({checklistIndex, itemIndex}) => {
            if (!selectedByChecklist.has(checklistIndex)) {
                selectedByChecklist.set(checklistIndex, new Set());
            }
            selectedByChecklist.get(checklistIndex)!.add(itemIndex);
        });

        if (playbookRun) {
            // Delete sequentially in descending index order to avoid index shifting.
            // Using Promise.allSettled here would cause race conditions since the
            // server API uses array indices, not stable IDs.
            let deleteFailures = 0;
            let deleteTotal = 0;
            for (const [checklistIndex, itemIndices] of selectedByChecklist.entries()) {
                const sortedIndices = [...itemIndices].sort((a, b) => b - a);
                for (const idx of sortedIndices) {
                    deleteTotal++;
                    try {
                        await clientDeleteChecklistItem(playbookRun.id, checklistIndex, idx); // eslint-disable-line no-await-in-loop
                    } catch {
                        deleteFailures++;
                    }
                }
            }
            if (deleteFailures > 0) {
                addToast({
                    content: formatMessage(
                        {defaultMessage: 'Failed to delete {count} of {total} tasks'},
                        {count: deleteFailures, total: deleteTotal},
                    ),
                    toastStyle: ToastStyle.Failure,
                });
            }
        } else {
            const newChecklists = checklists.map((cl, clIdx) => {
                const deletedIndices = selectedByChecklist.get(clIdx);
                if (!deletedIndices) {
                    return cl;
                }
                return {
                    ...cl,
                    items: cl.items.filter((_, itemIdx) => !deletedIndices.has(itemIdx)),
                };
            });

            setChecklistsForPlaybook(newChecklists);
        }
        setSelectedItems(new Map());
    };

    const handleBulkAddToCondition = (conditionId: string) => {
        const byChecklist = new Map<number, number[]>();
        selectedItems.forEach(({checklistIndex, itemIndex}) => {
            if (!byChecklist.has(checklistIndex)) {
                byChecklist.set(checklistIndex, []);
            }
            byChecklist.get(checklistIndex)!.push(itemIndex);
        });

        const updatedChecklists = [...checklists.map((cl) => ({...cl, items: [...cl.items]}))];

        for (const [clIdx, itemIndices] of byChecklist.entries()) {
            const sorted = [...itemIndices].sort((a, b) => b - a);
            for (const idx of sorted) {
                const item = updatedChecklists[clIdx].items[idx];
                if (item.condition_id === conditionId) {
                    continue;
                }

                const updatedItem = {...item, condition_id: conditionId};

                let lastConditionItemIndex = -1;
                for (let i = updatedChecklists[clIdx].items.length - 1; i >= 0; i--) {
                    if (updatedChecklists[clIdx].items[i].condition_id === conditionId) {
                        lastConditionItemIndex = i;
                        break;
                    }
                }

                if (lastConditionItemIndex >= 0 && lastConditionItemIndex !== idx) {
                    const newItems = [...updatedChecklists[clIdx].items];
                    newItems.splice(idx, 1);
                    const targetIndex = idx < lastConditionItemIndex ? lastConditionItemIndex : lastConditionItemIndex + 1;
                    newItems.splice(targetIndex, 0, updatedItem);
                    updatedChecklists[clIdx] = {...updatedChecklists[clIdx], items: newItems};
                } else {
                    const newItems = [...updatedChecklists[clIdx].items];
                    newItems[idx] = updatedItem;
                    updatedChecklists[clIdx] = {...updatedChecklists[clIdx], items: newItems};
                }
            }
        }
        setChecklistsForPlaybook(updatedChecklists);
    };

    const clearSelection = useCallback(() => {
        setSelectedItems(new Map());
        onExitBulkEdit?.();
    }, [onExitBulkEdit]);

    const effectiveBulkMode = bulkEditMode || selectedItems.size > 0;

    return {
        selectedItems,
        selectedIndices,
        selectedItemKeysSet,
        effectiveBulkMode,
        isSelectedIndex,
        onItemSelect,
        handleBulkAssign,
        handleBulkDueDate,
        handleBulkDelete,
        handleBulkAddToCondition,
        clearSelection,
    };
};
