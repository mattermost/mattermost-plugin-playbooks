// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useUpdateEffect} from 'react-use';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';
import {DraggableProvided} from 'react-beautiful-dnd';
import {FloatingPortal} from '@floating-ui/react';
import {UserProfile} from '@mattermost/types/users';

import {useAllowReferenceGroups} from 'src/hooks/use_allow_reference_groups';

import {
    clientAddChecklistItem,
    clientEditChecklistItem,
    clientSetChecklistItemCommand,
    setDueDate as clientSetDueDate,
    setAssignee,
    setChecklistItemState,
    setGroupAssignee,
    setPropertyUserAssignee,
    setRoleAssignee,
} from 'src/client';
import {ChecklistItemState, ChecklistItem as ChecklistItemType, TaskAction as TaskActionType} from 'src/types/playbook';
import {useUpdateRunItemTaskActions} from 'src/graphql/hooks';
import {Condition} from 'src/types/conditions';
import {useFormattedUsernameByID} from 'src/hooks/general';
import {PropertyField, PropertyFieldType, PropertyValue} from 'src/types/properties';
import {formatConditionExpr} from 'src/utils/condition_format';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {DateTimeOption} from 'src/components/datetime_selector';

import {Mode} from 'src/components/datetime_input';

import TaskLockdownIcon from 'src/components/checklists/task_lockdown_icon';

import TaskLockdownCheckbox from 'src/components/checklists/task_lockdown_checkbox';

import AssigneeDropdown from 'src/components/checklists/assignee_dropdown';

import ChecklistItemHoverMenu, {HoverMenu} from './hover_menu';
import ChecklistItemDescription from './description';
import ChecklistItemTitle from './title';
import AssignTo, {EXTRA_OPTION_PREFIX_GROUP, EXTRA_OPTION_PREFIX_PROPERTY_USER, EXTRA_OPTION_PREFIX_ROLE} from './assign_to';
import Command from './command';
import {CancelSaveButtons, CheckBoxButton} from './inputs';
import {DueDateButton} from './duedate';
import ConditionIndicator from './condition_indicator';

import TaskActions from './task_actions';
import {haveAtleastOneEnabledAction} from './task_actions_modal';

export enum ButtonsFormat {

    // All buttons are shown regardless of their state if they're editable;
    // owner name is shown completely
    Long = 'long',

    // Only buttons with a value are shown;
    // owner name is shown completely
    Mixed = 'mixed',

    // Only buttons with a value are shown;
    // owner name is not shown when other buttons have a value
    Short = 'short',
}

interface ChecklistItemProps {
    checklistItem: ChecklistItemType;
    checklistNum: number;
    itemNum: number;
    playbookRunId?: string;
    playbookId?: string;
    channelId?: string;
    onChange?: (item: ChecklistItemState) => ReturnType<typeof setChecklistItemState> | undefined;
    draggableProvided?: DraggableProvided;
    dragging: boolean;
    readOnly: boolean;
    dragDisabled?: boolean;
    collapsibleDescription: boolean;
    descriptionCollapsedByDefault?: boolean;
    newItem: boolean;
    cancelAddingItem?: () => void;
    onUpdateChecklistItem?: (newItem: ChecklistItemType) => void;
    onAddChecklistItem?: (newItem: ChecklistItemType) => void;
    onDuplicateChecklistItem?: () => void;
    onDeleteChecklistItem?: () => void;
    buttonsFormat?: ButtonsFormat;
    participantUserIds: string[];
    onReadOnlyInteract?: () => void;
    onAddConditional?: () => void;
    onRemoveFromCondition?: () => void;
    onAssignToCondition?: (conditionId: string) => void;
    availableConditions?: Condition[];
    conditions?: Condition[];
    propertyFields?: PropertyField[];
    propertyValues?: PropertyValue[];
    onEditingChange?: (isEditing: boolean) => void;
    hasCondition?: boolean;
    conditionHeader?: React.ReactNode;
    onSaveAndAddNew?: () => void;
    isChannelChecklist?: boolean;
    currentUserId?: string;
    runOwnerId?: string;
    runCreatorId?: string;
}

export const ChecklistItem = (props: ChecklistItemProps): React.ReactElement => {
    const {formatMessage} = useIntl();
    const toaster = useToaster();
    const isPlaybookEditor = !props.playbookRunId;
    const isMounted = useRef(true);
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const [showDescription, setShowDescription] = useState(!props.descriptionCollapsedByDefault);

    const getConditionTooltip = (item: ChecklistItemType): string => {
        if (item.condition_action === 'shown_because_modified') {
            return formatMessage({
                defaultMessage: 'Condition no longer met, but task shown because it was modified',
            });
        }

        // Get the reason - either from the item or format the condition expression
        let reason = item.condition_reason;
        if (!reason && item.condition_id && props.conditions && props.propertyFields) {
            const condition = props.conditions.find((c) => c.id === item.condition_id);
            if (condition) {
                reason = formatConditionExpr(condition.condition_expr, props.propertyFields);
            }
        }

        if (isPlaybookEditor) {
            return formatMessage(
                {defaultMessage: 'Shown when {reason}'},
                {reason},
            );
        }

        return formatMessage(
            {defaultMessage: 'Shown because {reason}'},
            {reason},
        );
    };
    const [isEditing, setIsEditing] = useState(props.newItem);
    const [isHoverMenuItemOpen, setIsHoverMenuItemOpen] = useState(false);
    const [titleValue, setTitleValue] = useState(props.checklistItem.title);
    const [descValue, setDescValue] = useState(props.checklistItem.description);
    const [command, setCommand] = useState(props.checklistItem.command);
    const [taskActions, setTaskActions] = useState(props.checklistItem.task_actions);
    const [assigneeID, setAssigneeID] = useState(props.checklistItem.assignee_id);
    const [assigneeGroupID, setAssigneeGroupID] = useState(props.checklistItem.assignee_group_id || '');
    const [assigneeType, setAssigneeType] = useState(props.checklistItem.assignee_type || '');
    const [assigneePropertyFieldID, setAssigneePropertyFieldID] = useState(props.checklistItem.assignee_property_field_id || '');
    const [dueDate, setDueDate] = useState(props.checklistItem.due_date);
    const {updateRunTaskActions} = useUpdateRunItemTaskActions(props.playbookRunId);
    const assigneeDisplayName = useFormattedUsernameByID(props.checklistItem.assignee_id);
    const groups = useAllowReferenceGroups();

    const userPropertyFields = useMemo(
        () => props.propertyFields?.filter((f) => f.type === PropertyFieldType.User) ?? [],
        [props.propertyFields],
    );

    const roleOptions = useMemo(() => {
        const opts = [
            {value: `${EXTRA_OPTION_PREFIX_ROLE}owner`, label: formatMessage({id: 'playbooks.assignee_dropdown.run_owner', defaultMessage: 'Run Owner'})},
            {value: `${EXTRA_OPTION_PREFIX_ROLE}creator`, label: formatMessage({id: 'playbooks.assignee_dropdown.run_creator', defaultMessage: 'Run Creator'})},
        ];
        for (const f of userPropertyFields) {
            opts.push({
                value: `${EXTRA_OPTION_PREFIX_PROPERTY_USER}${f.id}`,
                label: formatMessage({id: 'playbooks.assignee_dropdown.run_field_name', defaultMessage: 'Run {name}'}, {name: f.name}),
            });
        }
        return opts;
    }, [formatMessage, userPropertyFields]);

    const groupOptions = useMemo(
        () => groups.map((g) => ({id: g.id, displayName: g.display_name})),
        [groups],
    );

    // Merge local state into the checklistItem so child components see changes
    // immediately rather than waiting for a WebSocket round-trip or prop update.
    const localChecklistItem = useMemo(() => ({
        ...props.checklistItem,
        assignee_id: assigneeID,
        assignee_type: assigneeType,
        assignee_group_id: assigneeGroupID,
        assignee_property_field_id: assigneePropertyFieldID,
    }), [props.checklistItem, assigneeID, assigneeType, assigneeGroupID, assigneePropertyFieldID]);

    const getAssigneeName = (): string | undefined => {
        switch (assigneeType) {
        case 'owner':
            return formatMessage({defaultMessage: 'the Run Owner'});
        case 'creator':
            return formatMessage({defaultMessage: 'the Run Creator'});
        case 'group':
            return formatMessage({defaultMessage: 'a Group'});
        case 'property_user': {
            if (assigneeID) {
                return assigneeDisplayName || undefined;
            }
            const field = props.propertyFields?.find((f) => f.id === assigneePropertyFieldID);
            return field ?
                formatMessage({defaultMessage: 'Run {name}'}, {name: field.name}) :
                formatMessage({defaultMessage: 'Run User'});
        }
        default:
            return assigneeDisplayName || undefined;
        }
    };

    // Notify parent when editing state changes
    useUpdateEffect(() => {
        props.onEditingChange?.(isEditing);
    }, [isEditing]);

    const toggleDescription = () => setShowDescription(!showDescription);

    const isSkipped = () => {
        return props.checklistItem.state === ChecklistItemState.Skip;
    };

    useUpdateEffect(() => {
        setTitleValue(props.checklistItem.title);
    }, [props.checklistItem.title]);

    useUpdateEffect(() => {
        setDescValue(props.checklistItem.description);
    }, [props.checklistItem.description]);

    useUpdateEffect(() => {
        setCommand(props.checklistItem.command);
    }, [props.checklistItem.command]);

    useUpdateEffect(() => {
        setAssigneeID(props.checklistItem.assignee_id);
    }, [props.checklistItem.assignee_id]);

    useUpdateEffect(() => {
        setAssigneeGroupID(props.checklistItem.assignee_group_id || '');
    }, [props.checklistItem.assignee_group_id]);

    useUpdateEffect(() => {
        setAssigneeType(props.checklistItem.assignee_type || '');
    }, [props.checklistItem.assignee_type]);

    useUpdateEffect(() => {
        setAssigneePropertyFieldID(props.checklistItem.assignee_property_field_id || '');
    }, [props.checklistItem.assignee_property_field_id]);

    useUpdateEffect(() => {
        setDueDate(props.checklistItem.due_date);
    }, [props.checklistItem.due_date]);

    useUpdateEffect(() => {
        setTaskActions(props.checklistItem.task_actions);
    }, [props.checklistItem.task_actions]);

    const onAssigneeChange = async (user?: UserProfile) => {
        const userId = user?.id || '';
        setAssigneeID(userId);
        setAssigneeType('');
        setAssigneeGroupID('');
        setAssigneePropertyFieldID('');
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            const response = await setAssignee(props.playbookRunId, props.checklistNum, props.itemNum, userId);
            if (response.error && isMounted.current) {
                toaster.add({
                    content: formatMessage({id: 'playbooks.checklist_item.assignee_error', defaultMessage: 'Failed to update assignee.'}),
                    toastStyle: ToastStyle.Failure,
                });
            }
        } else {
            const newItem = {...props.checklistItem};
            newItem.assignee_id = userId;
            newItem.assignee_type = '';
            newItem.assignee_group_id = '';
            newItem.assignee_property_field_id = '';
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const handleAssigneeDropdownChange = useCallback(async (updatedItem: ChecklistItemType) => {
        setAssigneeID(updatedItem.assignee_id || '');
        setAssigneeGroupID(updatedItem.assignee_group_id || '');
        setAssigneeType(updatedItem.assignee_type || '');
        setAssigneePropertyFieldID(updatedItem.assignee_property_field_id || '');
        if (props.newItem) {
            return;
        }
        if (updatedItem.assignee_type === 'group' && updatedItem.assignee_group_id) {
            if (props.playbookRunId) {
                const response = await setGroupAssignee(props.playbookRunId, props.checklistNum, props.itemNum, updatedItem.assignee_group_id);
                if (response.error && isMounted.current) {
                    toaster.add({
                        content: formatMessage({id: 'playbooks.checklist_item.assignee_error', defaultMessage: 'Failed to update assignee.'}),
                        toastStyle: ToastStyle.Failure,
                    });
                }
            } else {
                props.onUpdateChecklistItem?.(updatedItem);
            }
        } else if (updatedItem.assignee_type === 'owner' || updatedItem.assignee_type === 'creator') {
            if (props.playbookRunId) {
                const response = await setRoleAssignee(props.playbookRunId, props.checklistNum, props.itemNum, updatedItem.assignee_type);
                if (response.error && isMounted.current) {
                    toaster.add({
                        content: formatMessage({id: 'playbooks.checklist_item.assignee_error', defaultMessage: 'Failed to update assignee.'}),
                        toastStyle: ToastStyle.Failure,
                    });
                }
            } else {
                props.onUpdateChecklistItem?.(updatedItem);
            }
        } else if (updatedItem.assignee_type === 'property_user' && updatedItem.assignee_property_field_id) {
            if (props.playbookRunId) {
                const response = await setPropertyUserAssignee(props.playbookRunId, props.checklistNum, props.itemNum, updatedItem.assignee_property_field_id);
                if (response.error && isMounted.current) {
                    toaster.add({
                        content: formatMessage({id: 'playbooks.checklist_item.assignee_error', defaultMessage: 'Failed to update assignee.'}),
                        toastStyle: ToastStyle.Failure,
                    });
                }
            } else {
                props.onUpdateChecklistItem?.(updatedItem);
            }
        } else if (props.playbookRunId) {
            const response = await setAssignee(props.playbookRunId, props.checklistNum, props.itemNum, updatedItem.assignee_id || '');
            if (response.error && isMounted.current) {
                toaster.add({
                    content: formatMessage({id: 'playbooks.checklist_item.assignee_error', defaultMessage: 'Failed to update assignee.'}),
                    toastStyle: ToastStyle.Failure,
                });
            }
        } else {
            props.onUpdateChecklistItem?.(updatedItem);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately using props.X instead of destructured values to keep the handler close to prop reads
    }, [props.playbookRunId, props.checklistNum, props.itemNum, props.newItem, props.onUpdateChecklistItem, formatMessage, toaster]);

    const onExtraOptionSelected = async (value: string) => {
        const updatedItem = {...props.checklistItem};
        updatedItem.assignee_id = '';

        if (value.startsWith(EXTRA_OPTION_PREFIX_ROLE)) {
            updatedItem.assignee_type = value.slice(EXTRA_OPTION_PREFIX_ROLE.length);
            updatedItem.assignee_group_id = '';
            updatedItem.assignee_property_field_id = '';
        } else if (value.startsWith(EXTRA_OPTION_PREFIX_GROUP)) {
            updatedItem.assignee_type = 'group';
            updatedItem.assignee_group_id = value.slice(EXTRA_OPTION_PREFIX_GROUP.length);
            updatedItem.assignee_property_field_id = '';
        } else if (value.startsWith(EXTRA_OPTION_PREFIX_PROPERTY_USER)) {
            updatedItem.assignee_type = 'property_user';
            updatedItem.assignee_group_id = '';
            updatedItem.assignee_property_field_id = value.slice(EXTRA_OPTION_PREFIX_PROPERTY_USER.length);
        }

        await handleAssigneeDropdownChange(updatedItem);
    };

    const onDueDateChange = async (value?: DateTimeOption | undefined | null) => {
        let timestamp = 0;
        if (value?.value) {
            timestamp = value?.value.toMillis();
        }
        setDueDate(timestamp);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            const response = await clientSetDueDate(props.playbookRunId, props.checklistNum, props.itemNum, timestamp);
            if (response.error) {
                console.log(response.error); // eslint-disable-line no-console
            }
        } else {
            const newItem = {...props.checklistItem};
            newItem.due_date = timestamp;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const onCommandChange = async (newCommand: string) => {
        setCommand(newCommand);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            clientSetChecklistItemCommand(props.playbookRunId, props.checklistNum, props.itemNum, newCommand);
        } else {
            const newItem = {...props.checklistItem};
            newItem.command = newCommand;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const onTaskActionsChange = async (newTaskActions: TaskActionType[]) => {
        setTaskActions(newTaskActions);
        if (props.newItem) {
            return;
        }
        if (props.playbookRunId) {
            updateRunTaskActions(props.checklistNum, props.itemNum, newTaskActions);
        } else {
            const newItem = {...props.checklistItem};
            newItem.task_actions = newTaskActions;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    // Renders the assignee editor above the toolbar — only when actively editing.
    // Kept separate from renderAssignTo so the toolbar Row remains unaffected.
    const renderAssigneeEditor = (): React.ReactNode => {
        return (
            <AssigneeEditorPanel>
                <AssigneeDropdown
                    checklistItem={localChecklistItem}
                    editable={true}
                    onChanged={handleAssigneeDropdownChange}
                    participantUserIds={props.participantUserIds}
                    runOwnerUserId={props.runOwnerId}
                    runCreatorUserId={props.runCreatorId}
                    mode={props.playbookRunId ? 'run' : 'template'}
                    propertyFields={props.propertyFields}
                />
            </AssigneeEditorPanel>
        );
    };

    const renderAssignTo = (): null | React.ReactNode => {
        if (isEditing) {
            // In edit mode the AssigneeDropdown in renderAssigneeEditor already
            // shows the assignee, so skip the read-only display here.
            return null;
        }

        const isRoleAssignee = assigneeType === 'owner' || assigneeType === 'creator';
        const isPropertyUserAssignee = assigneeType === 'property_user';
        const isGroupAssignee = assigneeType === 'group';

        if (!assigneeID && !assigneeGroupID && !isRoleAssignee && !isPropertyUserAssignee) {
            // hide when nothing is set
            return null;
        }

        if (isRoleAssignee || isPropertyUserAssignee || isGroupAssignee) {
            return (
                <AssigneeDropdown
                    checklistItem={localChecklistItem}
                    editable={false}
                    onChanged={handleAssigneeDropdownChange}
                    participantUserIds={props.participantUserIds}
                    runOwnerUserId={props.runOwnerId}
                    runCreatorUserId={props.runCreatorId}
                    mode={props.playbookRunId ? 'run' : 'template'}
                    propertyFields={props.propertyFields}
                    propertyValues={props.propertyValues}
                />
            );
        }

        return (
            <AssignTo
                participantUserIds={props.participantUserIds}
                assignee_id={assigneeID || ''}
                editable={!props.readOnly && !isSkipped()}
                onSelectedChange={onAssigneeChange}
                placement={'bottom-start'}
                isEditing={false}
            />
        );
    };

    const renderCommand = (): null | React.ReactNode => {
        if (!isEditing && !command) {
            // when not editing, hide when not set
            return null;
        }
        return (
            <Command
                checklistNum={props.checklistNum}
                command={command}
                command_last_run={props.checklistItem.command_last_run}
                disabled={!isEditing && (props.readOnly || isSkipped())}
                itemNum={props.itemNum}
                playbookRunId={props.playbookRunId}
                isEditing={isEditing}
                onChangeCommand={onCommandChange}
            />
        );
    };

    const renderDueDate = (): null | React.ReactNode => {
        const isTaskFinishedOrSkipped = props.checklistItem.state === ChecklistItemState.Closed || isSkipped();

        if (!isEditing && !dueDate) {
            // when not editing, hide when not set
            return null;
        }

        return (
            <DueDateButton
                editable={isEditing || (!props.readOnly && !isSkipped())}
                date={dueDate}
                ignoreOverdue={isTaskFinishedOrSkipped}
                mode={props.playbookRunId ? Mode.DateTimeValue : Mode.DurationValue}
                onSelectedChange={onDueDateChange}
                placement={'bottom-start'}
                isEditing={isEditing}
            />
        );
    };

    const renderTaskActions = (): null | React.ReactNode => {
        const hasEnabledActions = haveAtleastOneEnabledAction(taskActions);
        if (!isEditing && !hasEnabledActions) {
            // when not editing, hide when not set
            return null;
        }

        return (
            <TaskActions
                editable={isEditing || (!props.readOnly && !isSkipped())}
                taskActions={taskActions}
                onTaskActionsChange={onTaskActionsChange}
                isEditing={isEditing}
            />
        );
    };

    const handleSave = () => {
        setIsEditing(false);
        const finalTitle = titleValue.trim() || 'Untitled task';
        if (props.newItem) {
            props.cancelAddingItem?.();
            const newItem = {
                title: finalTitle,
                command,
                description: descValue,
                state: ChecklistItemState.Open,
                command_last_run: 0,
                due_date: dueDate,
                assignee_id: assigneeID,
                assignee_type: assigneeType,
                task_actions: taskActions,
                state_modified: 0,
                assignee_modified: 0,
                condition_id: '',
                condition_action: '',
                condition_reason: '',
                restrict_completion_to_assignee: false,
                assignee_group_id: assigneeGroupID,
                assignee_property_field_id: assigneePropertyFieldID,
            };
            if (props.playbookRunId) {
                clientAddChecklistItem(props.playbookRunId, props.checklistNum, newItem);
            } else {
                props.onAddChecklistItem?.(newItem);
            }
        } else if (props.playbookRunId) {
            clientEditChecklistItem(props.playbookRunId, props.checklistNum, props.itemNum, {
                title: finalTitle,
                command,
                description: descValue,
            });
        } else {
            const newItem = {...props.checklistItem};
            newItem.title = finalTitle;
            newItem.command = command;
            newItem.description = descValue;
            newItem.task_actions = taskActions;
            props.onUpdateChecklistItem?.(newItem);
        }
    };

    const handleSaveAndAddNew = () => {
        handleSave();
        props.onSaveAndAddNew?.();
    };

    const renderRow = (): null | React.ReactNode => {
        const haveTaskActions = taskActions?.length > 0;
        const isRoleAssignee = assigneeType === 'owner' || assigneeType === 'creator';
        const isPropertyUserAssignee = assigneeType === 'property_user';
        if (
            !isEditing &&
            !assigneeID &&
            !assigneeGroupID &&
            !isRoleAssignee &&
            !isPropertyUserAssignee &&
            !command &&
            !dueDate &&
            !haveTaskActions
        ) {
            // when not editing, hide row when nothing is set
            return null;
        }
        return (
            <Row>
                {renderAssignTo()}
                {renderCommand()}
                {renderDueDate()}
                {renderTaskActions()}
            </Row>
        );
    };

    const content = (
        <DraggableWrapper
            ref={props.draggableProvided?.innerRef}
            {...props.draggableProvided?.draggableProps}
        >
            {props.conditionHeader}
            <ItemContainer
                data-testid='checkbox-item-container'
                $editing={isEditing}
                $hoverMenuItemOpen={isHoverMenuItemOpen}
                $disabled={props.readOnly || isSkipped()}
                $hasCondition={props.hasCondition ?? false}
                $isPlaybookEditor={isPlaybookEditor}
            >
                <CheckboxContainer>
                    {!props.readOnly && !props.dragging &&
                    <ChecklistItemHoverMenu
                        playbookRunId={props.playbookRunId}
                        participantUserIds={props.participantUserIds}
                        checklistNum={props.checklistNum}
                        itemNum={props.itemNum}
                        isSkipped={isSkipped()}
                        onEdit={() => setIsEditing(true)}
                        isEditing={isEditing}
                        onChange={props.onChange}
                        description={props.checklistItem.description}
                        showDescription={showDescription}
                        toggleDescription={toggleDescription}
                        assignee_id={assigneeID || ''}
                        onAssigneeChange={onAssigneeChange}
                        onExtraOptionSelected={onExtraOptionSelected}
                        roleOptions={roleOptions}
                        groupOptions={groupOptions}
                        due_date={props.checklistItem.due_date}
                        onDueDateChange={onDueDateChange}
                        onDuplicateChecklistItem={props.onDuplicateChecklistItem}
                        onDeleteChecklistItem={props.onDeleteChecklistItem}
                        onItemOpenChange={setIsHoverMenuItemOpen}
                        onAddConditional={props.onAddConditional}
                        hasCondition={Boolean(props.checklistItem.condition_id)}
                        onRemoveFromCondition={props.onRemoveFromCondition}
                        onAssignToCondition={props.onAssignToCondition}
                        availableConditions={props.availableConditions}
                        propertyFields={props.propertyFields}
                        isChannelChecklist={props.isChannelChecklist}
                    />
                    }
                    <DragButton
                        title={formatMessage({defaultMessage: 'Drag me to reorder'})}
                        className={'icon icon-drag-vertical'}
                        {...props.draggableProvided?.dragHandleProps}
                        $isVisible={!props.readOnly && !props.dragDisabled}
                        $isDragging={props.dragging}
                    />
                    {props.playbookRunId ? (
                        <TaskLockdownCheckbox
                            item={props.checklistItem}
                            currentUserId={props.currentUserId || ''}
                            runOwnerId={props.runOwnerId || ''}
                            runCreatorId={props.runCreatorId || ''}
                            assigneeName={getAssigneeName()}
                            onChange={(s) => props.onChange?.(s)}
                            readOnly={props.readOnly || isSkipped() || props.newItem}
                        />
                    ) : (
                        <>
                            <CheckBoxButton
                                readOnly={props.readOnly}
                                disabled={isSkipped() || props.playbookRunId === undefined || props.newItem}
                                item={props.checklistItem}
                                onChange={(item: ChecklistItemState) => props.onChange?.(item)}
                                onReadOnlyInteract={props.onReadOnlyInteract}
                            />
                            {isEditing && (assigneeID || assigneeGroupID || assigneeType === 'owner' || assigneeType === 'creator' || assigneeType === 'property_user') && (
                                <TaskLockdownIcon
                                    item={props.checklistItem}
                                    onChange={(updated) => props.onUpdateChecklistItem?.(updated)}
                                />
                            )}
                        </>
                    )}
                    <ConditionIndicator
                        checklistItem={props.checklistItem}
                        tooltipMessage={getConditionTooltip(props.checklistItem)}
                    />
                    <ChecklistItemTitleWrapper
                        onClick={() => props.collapsibleDescription && props.checklistItem.description !== '' && toggleDescription()}
                    >
                        <ChecklistItemTitle
                            editingItem={isEditing}
                            onEdit={setTitleValue}
                            value={titleValue}
                            skipped={isSkipped()}
                            clickable={props.collapsibleDescription && props.checklistItem.description !== ''}
                            onDeleteEmpty={props.newItem ? props.cancelAddingItem : props.onDeleteChecklistItem}
                            onSaveAndAddNew={props.onSaveAndAddNew ? handleSaveAndAddNew : undefined}
                        />
                    </ChecklistItemTitleWrapper>
                </CheckboxContainer>
                {(descValue || isEditing) &&
                <ChecklistItemDescription
                    editingItem={isEditing}
                    showDescription={showDescription}
                    onEdit={setDescValue}
                    value={descValue}
                    onSave={handleSave}
                    onSaveAndAddNew={props.onSaveAndAddNew ? handleSaveAndAddNew : undefined}
                    title={titleValue}
                />
                }
                {isEditing && renderAssigneeEditor()}
                {renderRow()}
                {isEditing &&
                <CancelSaveButtons
                    onCancel={() => {
                        setIsEditing(false);
                        setTitleValue(props.checklistItem.title);
                        setDescValue(props.checklistItem.description);
                        props.cancelAddingItem?.();
                    }}
                    onSave={handleSave}
                />
                }
            </ItemContainer>
        </DraggableWrapper>
    );

    if (props.dragging) {
        return <FloatingPortal>{content}</FloatingPortal>;
    }

    return content;
};

export const CheckboxContainer = styled.div`
    position: relative;
    display: flex;
    align-items: flex-start;

    &:hover {
        .checkbox-container__close {
            opacity: 1;
        }
    }

    .icon-bars {
        padding: 0 0.8rem 0 0;
    }

    input[type="checkbox"] {
        display: flex;
        width: 16px;
        min-width: 16px;
        height: 16px;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
        border-radius: 2px;
        margin: 0;
        margin-top: 2px;
        margin-right: 8px;
        appearance: none;
        background: var(--center-channel-bg);
        cursor: pointer;
    }

    input[type="checkbox"]:checked {
        box-sizing: border-box;
        border: 1px solid var(--button-bg);
        background: var(--button-bg);
    }

    input[type="checkbox"]::before {
        position: relative;
        color: var(--center-channel-bg);
        content: "\f012c";
        font-family: compass-icons, mattermosticons;
        font-size: 12px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-weight: bold;
        text-rendering: auto;
        transform: scale(0) rotate(90deg);
        transition: transform 0.15s;
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(0deg);
    }

    input[type="checkbox"]:disabled {
        opacity: 0.38;
    }

    label {
        display: inline;
        flex-grow: 1;
        margin: 0;
        margin-right: 8px;
        font-weight: normal;
        /* stylelint-disable-next-line declaration-property-value-keyword-no-deprecated */
        word-break: break-word;
    }
`;

const ChecklistItemTitleWrapper = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;

const DragButton = styled.i<{$isVisible: boolean, $isDragging: boolean}>`
    cursor: pointer;
    width: 4px;
    margin-right: 4px;
    margin-left: 4px;
    margin-top: 1px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    opacity: 0;
    ${({$isVisible}) => !$isVisible && css`
        visibility: hidden;
    `}
    ${({$isDragging}) => $isDragging && css`
        opacity: 1;
    `}
`;

const Row = styled.div`
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    margin-top: 8px;
    margin-right: 10px;
    margin-left: 35px;
    gap: 5px 8px;
`;

const AssigneeEditorPanel = styled.div`
    margin: 8px 10px 0 35px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    padding: 8px;
    background: var(--center-channel-bg);
`;

const DraggableWrapper = styled.div`
    /* Wrapper for draggable item including condition header */
`;

const ItemContainer = styled.div<{$editing: boolean, $disabled: boolean, $hoverMenuItemOpen: boolean, $hasCondition: boolean, $isPlaybookEditor: boolean}>`
    margin-bottom: 4px;
    padding: 8px 0;

    ${({$hasCondition, $isPlaybookEditor}) => $hasCondition && $isPlaybookEditor && css`
        margin-left: 15px;
        padding-left: 5px;
        border-left: 2px solid rgba(var(--center-channel-color-rgb), 0.16);
    `}

    ${({$hoverMenuItemOpen}) => !$hoverMenuItemOpen && css`
        ${HoverMenu} {
            opacity: 0;
        }
    `}

    .checklists:not(.isDragging) & {
        /* not dragging and hover or focus-within */
        &:hover,
        &:focus-within {
            ${DragButton},
            ${HoverMenu} {
                opacity: 1;
            }
        }
    }

    ${({$editing}) => $editing && css`
        background-color: var(--button-bg-08);
    `}

    ${({$disabled, $editing}) => !$editing && $disabled && css`
        ${ChecklistItemTitleWrapper},
        & > ${Row} {
            opacity: 0.64;
        }

        ${HoverMenu} {
            z-index: 1;
        }
    `}

    ${({$editing, $disabled}) => !$editing && !$disabled && css`
        .checklists:not(.isDragging) &:hover {
            background: var(--center-channel-color-04);
        }
    `}
`;
