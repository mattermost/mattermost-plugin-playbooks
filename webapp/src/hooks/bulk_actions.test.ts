// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react-hooks';
import * as redux from 'react-redux';

import {Checklist, ChecklistItem, emptyChecklistItem} from 'src/types/playbook';

import {useBulkActions} from './bulk_actions';

// --- Mocks ---

jest.mock('src/client', () => ({
    setAssignee: jest.fn(),
    setDueDate: jest.fn(),
    clientDeleteChecklistItem: jest.fn(),
}));

jest.mock('src/actions', () => ({
    playbookRunUpdated: jest.fn((run: any) => ({type: 'PLAYBOOK_RUN_UPDATED', run})),
}));

jest.mock('src/components/backstage/toast_banner', () => ({
    useToaster: jest.fn(),
}));

jest.mock('react-intl', () => {
    const reactIntl = jest.requireActual('react-intl');
    const intl = reactIntl.createIntl({locale: 'en'});
    return {
        ...reactIntl,
        useIntl: () => intl,
    };
});

jest.mock('react-redux', () => {
    const actual = jest.requireActual<typeof import('react-redux')>('react-redux');
    return {
        ...actual,
        useDispatch: jest.fn(),
    };
});

// --- Type helpers ---

const makeItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
    ...emptyChecklistItem(),
    id: 'item-1',
    title: 'Test item',
    ...overrides,
});

const makeChecklist = (items: ChecklistItem[] = [makeItem()]): Checklist => ({
    title: 'Checklist 1',
    items,
});

const makeRun = (checklists: Checklist[] = [makeChecklist()]): any => ({
    id: 'run-1',
    checklists,
});

const {setAssignee, setDueDate, clientDeleteChecklistItem} = jest.requireMock('src/client');
const {playbookRunUpdated} = jest.requireMock('src/actions');
const {useToaster} = jest.requireMock('src/components/backstage/toast_banner');

// --- Setup ---

const mockAddToast = jest.fn();
const mockDispatch = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    useToaster.mockReturnValue({add: mockAddToast});
    (redux.useDispatch as jest.Mock).mockReturnValue(mockDispatch);
    playbookRunUpdated.mockImplementation((run: any) => ({type: 'PLAYBOOK_RUN_UPDATED', run}));
});

// --- Tests ---

describe('useBulkActions', () => {
    describe('onItemSelect', () => {
        it('adds an item to selection when not present', () => {
            const checklist = makeChecklist([makeItem({id: 'i1', title: 'Item 1'})]);
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, checklist.items[0]);
            });

            expect(result.current.selectedItems.size).toBe(1);
            expect(result.current.selectedItems.has('key-1')).toBe(true);
        });

        it('removes an item from selection when already present (toggle)', () => {
            const checklist = makeChecklist([makeItem({id: 'i1', title: 'Item 1'})]);
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, checklist.items[0]);
            });
            expect(result.current.selectedItems.size).toBe(1);

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, checklist.items[0]);
            });
            expect(result.current.selectedItems.size).toBe(0);
        });

        it('supports multiple distinct items in selection', () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const checklist = makeChecklist([item1, item2]);
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, item1);
                result.current.onItemSelect('key-2', 0, 1, item2);
            });

            expect(result.current.selectedItems.size).toBe(2);
        });
    });

    describe('effectiveBulkMode', () => {
        it('is false when bulkEditMode is false and no items selected', () => {
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [makeChecklist()],
                    setChecklistsForPlaybook: jest.fn(),
                    bulkEditMode: false,
                }),
            );
            expect(result.current.effectiveBulkMode).toBe(false);
        });

        it('is true when bulkEditMode is true', () => {
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [makeChecklist()],
                    setChecklistsForPlaybook: jest.fn(),
                    bulkEditMode: true,
                }),
            );
            expect(result.current.effectiveBulkMode).toBe(true);
        });

        it('is true when selectedItems.size > 0 even without bulkEditMode', () => {
            const item = makeItem();
            const checklist = makeChecklist([item]);
            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                    bulkEditMode: false,
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, item);
            });

            expect(result.current.effectiveBulkMode).toBe(true);
        });
    });

    describe('selection cleared when bulkEditMode becomes false', () => {
        it('clears selections when bulkEditMode transitions from true to false', () => {
            const item = makeItem();
            const checklist = makeChecklist([item]);
            let bulkEditMode = true;

            const {result, rerender} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                    bulkEditMode,
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, item);
            });
            expect(result.current.selectedItems.size).toBe(1);

            bulkEditMode = false;
            rerender();

            expect(result.current.selectedItems.size).toBe(0);
        });
    });

    describe('clearSelection', () => {
        it('empties selection and calls onExitBulkEdit', () => {
            const item = makeItem();
            const checklist = makeChecklist([item]);
            const onExitBulkEdit = jest.fn();

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                    onExitBulkEdit,
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, item);
            });
            expect(result.current.selectedItems.size).toBe(1);

            act(() => {
                result.current.clearSelection();
            });

            expect(result.current.selectedItems.size).toBe(0);
            expect(onExitBulkEdit).toHaveBeenCalledTimes(1);
        });

        it('does not throw when onExitBulkEdit is not provided', () => {
            const item = makeItem();
            const checklist = makeChecklist([item]);

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-1', 0, 0, item);
            });

            expect(() => {
                act(() => {
                    result.current.clearSelection();
                });
            }).not.toThrow();

            expect(result.current.selectedItems.size).toBe(0);
        });
    });

    describe('handleBulkAssign — playbookRun path', () => {
        it('dispatches updated run with all items on full success', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const checklist = makeChecklist([item1, item2]);
            const run = makeRun([checklist]);

            setAssignee.mockResolvedValue({});

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            await act(async () => {
                await result.current.handleBulkAssign('user-abc');
            });

            expect(setAssignee).toHaveBeenCalledTimes(2);
            expect(mockAddToast).not.toHaveBeenCalled();
            expect(playbookRunUpdated).toHaveBeenCalledTimes(1);

            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].assignee_id).toBe('user-abc');
            expect(dispatchedRun.checklists[0].items[1].assignee_id).toBe('user-abc');
        });

        it('shows failure toast and dispatches no updated items when all fail', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const checklist = makeChecklist([item1]);
            const run = makeRun([checklist]);

            // setAssignee returns {error} on failure (fulfilled, not rejected)
            setAssignee.mockResolvedValue({error: 'server error'});

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            await act(async () => {
                await result.current.handleBulkAssign('user-abc');
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const toastCall = mockAddToast.mock.calls[0][0];
            expect(toastCall.content).toContain('1 of 1');

            // Dispatched with no items updated (assignee_id unchanged)
            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].assignee_id).toBe('');
        });

        it('shows partial failure toast and only updates succeeded items', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const checklist = makeChecklist([item1, item2]);
            const run = makeRun([checklist]);

            setAssignee
                .mockResolvedValueOnce({}) // item1 succeeds
                .mockResolvedValueOnce({error: 'fail'}); // item2 fails

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            await act(async () => {
                await result.current.handleBulkAssign('user-abc');
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const toastContent = mockAddToast.mock.calls[0][0].content;
            expect(toastContent).toContain('1 of 2');

            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];

            // item1 (0-0) should be updated, item2 (0-1) should not
            expect(dispatchedRun.checklists[0].items[0].assignee_id).toBe('user-abc');
            expect(dispatchedRun.checklists[0].items[1].assignee_id).toBe('');
        });

        it('handles rejected promises the same as error responses', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const checklist = makeChecklist([item1]);
            const run = makeRun([checklist]);

            setAssignee.mockRejectedValue(new Error('network error'));

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            await act(async () => {
                await result.current.handleBulkAssign('user-abc');
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].assignee_id).toBe('');
        });
    });

    describe('handleBulkAssign — playbook path', () => {
        it('calls setChecklistsForPlaybook with updated items (no dispatch)', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const checklist = makeChecklist([item1, item2]);
            const setChecklistsForPlaybook = jest.fn();

            const {result} = renderHook(() =>
                useBulkActions({
                    playbook: {id: 'pb-1'} as any,
                    checklists: [checklist],
                    setChecklistsForPlaybook,
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            await act(async () => {
                await result.current.handleBulkAssign('user-xyz');
            });

            expect(setChecklistsForPlaybook).toHaveBeenCalledTimes(1);
            expect(mockDispatch).not.toHaveBeenCalled();

            const newChecklists = setChecklistsForPlaybook.mock.calls[0][0];
            expect(newChecklists[0].items[0].assignee_id).toBe('user-xyz');

            // item2 was not selected so it remains unchanged
            expect(newChecklists[0].items[1].assignee_id).toBe('');
        });
    });

    describe('handleBulkDueDate — playbookRun path', () => {
        it('dispatches run update with due_date on full success', async () => {
            const item1 = makeItem({id: 'i1'});
            const checklist = makeChecklist([item1]);
            const run = makeRun([checklist]);

            setDueDate.mockResolvedValue({});

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            const timestamp = 1700000000000;
            await act(async () => {
                await result.current.handleBulkDueDate(timestamp);
            });

            expect(mockAddToast).not.toHaveBeenCalled();
            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].due_date).toBe(timestamp);
        });

        it('shows failure toast and leaves due_date unchanged when all fail', async () => {
            const item1 = makeItem({id: 'i1'});
            const checklist = makeChecklist([item1]);
            const run = makeRun([checklist]);

            setDueDate.mockResolvedValue({error: 'server error'});

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            await act(async () => {
                await result.current.handleBulkDueDate(1700000000000);
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const toastContent = mockAddToast.mock.calls[0][0].content;
            expect(toastContent).toContain('1 of 1');

            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].due_date).toBe(0);
        });

        it('shows partial failure toast and updates only succeeded items', async () => {
            const item1 = makeItem({id: 'i1'});
            const item2 = makeItem({id: 'i2'});
            const checklist = makeChecklist([item1, item2]);
            const run = makeRun([checklist]);

            setDueDate
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({error: 'fail'});

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            const timestamp = 1700000000000;
            await act(async () => {
                await result.current.handleBulkDueDate(timestamp);
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const dispatchedRun = playbookRunUpdated.mock.calls[0][0];
            expect(dispatchedRun.checklists[0].items[0].due_date).toBe(timestamp);
            expect(dispatchedRun.checklists[0].items[1].due_date).toBe(0);
        });
    });

    describe('handleBulkDelete — playbookRun path', () => {
        it('calls clientDeleteChecklistItem for each selected item and clears selection', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const checklist = makeChecklist([item1, item2]);
            const run = makeRun([checklist]);

            clientDeleteChecklistItem.mockResolvedValue(undefined);

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            expect(result.current.selectedItems.size).toBe(2);

            await act(async () => {
                await result.current.handleBulkDelete();
            });

            expect(clientDeleteChecklistItem).toHaveBeenCalledTimes(2);
            expect(mockAddToast).not.toHaveBeenCalled();

            // Selection should be cleared after delete
            expect(result.current.selectedItems.size).toBe(0);
        });

        it('shows failure toast when clientDeleteChecklistItem throws', async () => {
            const item1 = makeItem({id: 'i1'});
            const checklist = makeChecklist([item1]);
            const run = makeRun([checklist]);

            clientDeleteChecklistItem.mockRejectedValue(new Error('delete failed'));

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            await act(async () => {
                await result.current.handleBulkDelete();
            });

            expect(mockAddToast).toHaveBeenCalledTimes(1);
            const toastContent = mockAddToast.mock.calls[0][0].content;
            expect(toastContent).toContain('1 of 1');

            // Selection still clears after delete attempt
            expect(result.current.selectedItems.size).toBe(0);
        });

        it('deletes in descending index order to avoid index shifting', async () => {
            const item1 = makeItem({id: 'i1', title: 'Item 1'});
            const item2 = makeItem({id: 'i2', title: 'Item 2'});
            const item3 = makeItem({id: 'i3', title: 'Item 3'});
            const checklist = makeChecklist([item1, item2, item3]);
            const run = makeRun([checklist]);

            const deleteOrder: number[] = [];
            clientDeleteChecklistItem.mockImplementation(
                (_runId: string, _clIdx: number, itemIdx: number) => {
                    deleteOrder.push(itemIdx);
                    return Promise.resolve(undefined);
                },
            );

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                // Select item at index 0 and index 2
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-2', 0, 2, item3);
            });

            await act(async () => {
                await result.current.handleBulkDelete();
            });

            // Should delete index 2 before index 0 (descending)
            expect(deleteOrder).toEqual([2, 0]);
        });

        it('clears selection after delete even with partial failures', async () => {
            const item1 = makeItem({id: 'i1'});
            const item2 = makeItem({id: 'i2'});
            const checklist = makeChecklist([item1, item2]);
            const run = makeRun([checklist]);

            clientDeleteChecklistItem
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('fail'));

            const {result} = renderHook(() =>
                useBulkActions({
                    playbookRun: run,
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            await act(async () => {
                await result.current.handleBulkDelete();
            });

            expect(result.current.selectedItems.size).toBe(0);
        });
    });

    describe('handleBulkDelete — playbook path', () => {
        it('calls setChecklistsForPlaybook with filtered items', async () => {
            const item1 = makeItem({id: 'i1', title: 'Keep me'});
            const item2 = makeItem({id: 'i2', title: 'Delete me'});
            const checklist = makeChecklist([item1, item2]);
            const setChecklistsForPlaybook = jest.fn();

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook,
                }),
            );

            act(() => {
                // Only select item2 (index 1)
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            await act(async () => {
                await result.current.handleBulkDelete();
            });

            expect(setChecklistsForPlaybook).toHaveBeenCalledTimes(1);
            const newChecklists = setChecklistsForPlaybook.mock.calls[0][0];
            expect(newChecklists[0].items).toHaveLength(1);
            expect(newChecklists[0].items[0].title).toBe('Keep me');
        });
    });

    describe('handleBulkAddToCondition', () => {
        it('moves selected items to the end of the target condition group', () => {
            const itemA = makeItem({id: 'iA', title: 'Item A', condition_id: 'cond-x'});
            const itemB = makeItem({id: 'iB', title: 'Item B (target cond)', condition_id: 'cond-target'});
            const itemC = makeItem({id: 'iC', title: 'Item C', condition_id: 'cond-x'});
            const checklist = makeChecklist([itemA, itemB, itemC]);
            const setChecklistsForPlaybook = jest.fn();

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook,
                }),
            );

            // Select itemA and itemC (both have cond-x, not cond-target)
            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, itemA);
                result.current.onItemSelect('key-0-2', 0, 2, itemC);
            });

            act(() => {
                result.current.handleBulkAddToCondition('cond-target');
            });

            expect(setChecklistsForPlaybook).toHaveBeenCalledTimes(1);
            const newChecklists = setChecklistsForPlaybook.mock.calls[0][0];
            const newItems = newChecklists[0].items;

            // All items should now have cond-target
            newItems.forEach((item: ChecklistItem) => {
                expect(item.condition_id).toBe('cond-target');
            });
        });

        it('skips items that already have the target condition_id', () => {
            const itemA = makeItem({id: 'iA', title: 'Item A', condition_id: 'cond-target'});
            const checklist = makeChecklist([itemA]);
            const setChecklistsForPlaybook = jest.fn();

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook,
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, itemA);
            });

            act(() => {
                result.current.handleBulkAddToCondition('cond-target');
            });

            expect(setChecklistsForPlaybook).toHaveBeenCalledTimes(1);
            const newChecklists = setChecklistsForPlaybook.mock.calls[0][0];

            // Item should remain with the same condition_id, no position change
            expect(newChecklists[0].items[0].condition_id).toBe('cond-target');
        });
    });

    describe('selectedIndices and isSelectedIndex', () => {
        it('selectedIndices tracks checklist+item index pairs', () => {
            const item1 = makeItem({id: 'i1'});
            const item2 = makeItem({id: 'i2'});
            const checklist = makeChecklist([item1, item2]);

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-1', 0, 1, item2);
            });

            expect(result.current.selectedIndices.has('0-1')).toBe(true);
            expect(result.current.selectedIndices.has('0-0')).toBe(false);
        });

        it('isSelectedIndex returns true for selected index pairs', () => {
            const item1 = makeItem({id: 'i1'});
            const checklist = makeChecklist([item1]);

            const {result} = renderHook(() =>
                useBulkActions({
                    checklists: [checklist],
                    setChecklistsForPlaybook: jest.fn(),
                }),
            );

            act(() => {
                result.current.onItemSelect('key-0-0', 0, 0, item1);
            });

            expect(result.current.isSelectedIndex(0, 0)).toBe(true);
            expect(result.current.isSelectedIndex(0, 1)).toBe(false);
            expect(result.current.isSelectedIndex(1, 0)).toBe(false);
        });
    });
});
