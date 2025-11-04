// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import {FormattedMessage, useIntl} from 'react-intl';
import {
    ChevronDownCircleOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    MenuVariantIcon,
} from '@mattermost/compass-icons/components';

import {usePlaybook} from 'src/graphql/hooks';
import {PropertyField, PropertyFieldInput, PropertyFieldType} from 'src/types/properties';

import GenericModal from 'src/components/widgets/generic_modal';

import {usePlaybookAttributes} from 'src/hooks';
import {addPlaybookPropertyFieldAction, deletePlaybookPropertyFieldAction, updatePlaybookPropertyFieldAction} from 'src/actions';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import {MAX_PROPERTIES_LIMIT} from 'src/constants';

import PropertyValuesInput from './property_values_input';
import PropertyDotMenu from './property_dot_menu';
import PropertyTypeSelector from './property_type_selector';
import EmptyState from './empty_state';
import PropertyNameInput, {PropertyNameInputRef} from './property_name_input';

interface Props {
    playbookID: string;
}

const PlaybookProperties = ({playbookID}: Props) => {
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const dispatch = useDispatch();

    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [deletingProperty, setDeletingProperty] = useState<PropertyField | null>(null);
    const nameInputRefs = useRef<{[key: string]: PropertyNameInputRef | null}>({});

    const [playbook, playbookResult] = usePlaybook(playbookID);
    const properties = usePlaybookAttributes(playbookID) || [];

    const updateProperty = useCallback(async (updatedProperty: PropertyField) => {
        const propertyFieldInput: PropertyFieldInput = {
            name: updatedProperty.name,
            type: updatedProperty.type,
            attrs: {
                visibility: updatedProperty.attrs.visibility,
                sort_order: updatedProperty.attrs.sort_order,
                options: updatedProperty.attrs.options || undefined,
                value_type: updatedProperty.attrs.value_type,
            },
        };

        try {
            await dispatch(updatePlaybookPropertyFieldAction(playbookID, updatedProperty.id, propertyFieldInput));
        } catch (error) {
            addToast({
                content: error instanceof Error ? error.message : 'Failed to update property field',
                toastStyle: ToastStyle.Failure,
                duration: 8000,
            });
        }
    }, [dispatch, playbookID, addToast]);

    const deleteProperty = useCallback(async (propertyId: string) => {
        try {
            await dispatch(deletePlaybookPropertyFieldAction(playbookID, propertyId));
            return true;
        } catch (error) {
            addToast({
                content: error instanceof Error ? error.message : 'Failed to delete property field',
                toastStyle: ToastStyle.Failure,
                duration: 8000,
            });
            return false;
        }
    }, [dispatch, playbookID, addToast]);

    const addProperty = useCallback(async () => {
        if (properties.length >= MAX_PROPERTIES_LIMIT) {
            return;
        }

        // Find the highest number in existing "Attribute X" names
        const attributeNumbers = properties
            .map((prop) => {
                const match = prop.name.match(/^Attribute (\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter((num) => num > 0);
        const nextNumber = attributeNumbers.length > 0 ? Math.max(...attributeNumbers) + 1 : 1;

        const newPropertyField: PropertyFieldInput = {
            name: `Attribute ${nextNumber}`,
            type: PropertyFieldType.Text,
            attrs: {
                visibility: 'when_set',
                sort_order: properties.length,
            },
        };

        await dispatch(addPlaybookPropertyFieldAction(playbookID, newPropertyField));

        // Wait for the property to be added to the list and rendered
        // Redux state will update automatically
        setTimeout(() => {
            // Find the newly added property by name
            const newProperty = properties.find((p) => p.name === newPropertyField.name);
            if (newProperty) {
                const input = nameInputRefs.current[newProperty.id];
                if (input) {
                    input.focus();
                    input.select();
                }
            }
        }, 200);
    }, [dispatch, playbookID, properties]);

    const handleDragEnd = useCallback(async (result: any) => {
        if (!result.destination) {
            return;
        }

        const reorderedProperties = Array.from(properties);
        const [removed] = reorderedProperties.splice(result.source.index, 1);
        reorderedProperties.splice(result.destination.index, 0, removed);

        // Update sort_order for all properties that changed
        reorderedProperties.forEach(async (field, index) => {
            const nextSortOrder = index;

            if (field.attrs.sort_order !== nextSortOrder) {
                const updatedField = {
                    ...field,
                    attrs: {
                        ...field.attrs,
                        sort_order: nextSortOrder,
                    },
                };
                await updateProperty(updatedField);
            }
        });
    }, [properties, updateProperty]);

    const columnHelper = createColumnHelper<PropertyField>();

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'drag',
                header: '',
                size: 18,
                cell: () => (
                    <DragHandle>
                        <i className='icon-drag-vertical'/>
                    </DragHandle>
                ),
            }),
            columnHelper.display({
                id: 'property',
                header: () => (
                    <FormattedMessage defaultMessage='Attribute'/>
                ),
                size: 130,
                cell: (info) => {
                    const TypeIcon = () => {
                        switch (info.row.original.type) {
                        case 'text':
                            switch (info.row.original.attrs?.value_type) {
                            case 'url':
                                return <LinkVariantIcon size={16}/>;
                            default:
                                return <MenuVariantIcon size={16}/>;
                            }
                        case 'select':
                            return <ChevronDownCircleOutlineIcon size={16}/>;
                        case 'multiselect':
                            return <FormatListBulletedIcon size={16}/>;
                        default:
                            return <MenuVariantIcon size={16}/>;
                        }
                    };

                    const target = (
                        <TypeIconButton
                            onClick={() => setEditingTypeId(info.row.original.id)}
                            aria-label={formatMessage({defaultMessage: 'Change attribute type'})}
                        >
                            <TypeIcon/>
                        </TypeIconButton>
                    );

                    return (
                        <PropertyCellContent>
                            {editingTypeId === info.row.original.id ? (
                                <PropertyTypeSelector
                                    field={info.row.original}
                                    updateField={updateProperty}
                                    onClose={() => setEditingTypeId(null)}
                                    isOpen={editingTypeId === info.row.original.id}
                                    onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setEditingTypeId(null);
                                        }
                                    }}
                                    target={target}
                                />
                            ) : (
                                target
                            )}
                            <PropertyNameInput
                                ref={(el) => {
                                    nameInputRefs.current[info.row.original.id] = el;
                                }}
                                field={info.row.original}
                                updateField={updateProperty}
                                existingNames={properties.map((p) => p.name)}
                            />
                        </PropertyCellContent>
                    );
                },
            }),
            columnHelper.display({
                id: 'values',
                header: () => (
                    <FormattedMessage defaultMessage='Values'/>
                ),
                size: 300,
                cell: (info) => (
                    <PropertyValuesInput
                        field={info.row.original}
                        updateField={updateProperty}
                    />
                ),
            }),
            columnHelper.display({
                id: 'actions',
                header: () => (
                    <HeaderColEnd>
                        <FormattedMessage defaultMessage='Actions'/>
                    </HeaderColEnd>
                ),
                size: 40,
                cell: (info) => (
                    <PropertyDotMenu
                        field={info.row.original}
                        onRename={(field) => {
                            setTimeout(() => {
                                const input = nameInputRefs.current[field.id];
                                if (input) {
                                    input.focus();
                                    input.select();
                                }
                            }, 50);
                        }}
                        onEditType={(field) => {
                            setEditingTypeId(field.id);
                        }}
                        onDelete={(field) => setDeletingProperty(field)}
                        onDuplicate={async (field) => {
                            const duplicatedPropertyField: PropertyFieldInput = {
                                name: `${field.name} Copy`,
                                type: field.type as PropertyFieldType,
                                attrs: {
                                    visibility: field.attrs.visibility,
                                    sort_order: properties.length + 1,
                                    options: field.attrs.options?.map((opt) => ({
                                        name: opt.name,
                                        color: opt.color,
                                    })) || undefined,
                                    value_type: field.attrs.value_type,
                                },
                            };

                            await dispatch(addPlaybookPropertyFieldAction(playbookID, duplicatedPropertyField));
                        }}
                    />
                ),
            }),
        ],
        [columnHelper, formatMessage, updateProperty, deleteProperty, properties, editingTypeId, dispatch, playbookID]
    );

    const table = useReactTable({
        data: properties,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (playbookResult.loading) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <div>
                        <FormattedMessage defaultMessage='Loading…'/>
                    </div>
                </InnerContainer>
            </OuterContainer>
        );
    }

    if (playbookResult.error || !playbook) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <div>
                        <FormattedMessage defaultMessage='Error loading playbook attributes. Please try again.'/>
                    </div>
                </InnerContainer>
            </OuterContainer>
        );
    }

    if (properties.length === 0) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <EmptyState
                        title={<FormattedMessage defaultMessage='No attributes yet'/>}
                        description={<FormattedMessage defaultMessage='Add custom attributes to capture additional information about your playbook runs.'/>}
                        buttonText={<FormattedMessage defaultMessage='Add your first attribute'/>}
                        onButtonClick={addProperty}
                    />
                </InnerContainer>
            </OuterContainer>
        );
    }

    return (
        <OuterContainer>
            <InnerContainer>
                <TableContainer>
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId='properties-table'>
                            {(provided) => (
                                <Table
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                >
                                    <TableHeader>
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <TableHeaderCell
                                                        key={header.id}
                                                        style={{width: header.getSize()}}
                                                    >
                                                        {header.isPlaceholder ? null : (
                                                            flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )
                                                        )}
                                                    </TableHeaderCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows.map((row, index) => (
                                            <Draggable
                                                key={row.original.id}
                                                draggableId={row.original.id}
                                                index={index}
                                            >
                                                {(dragProvided) => (
                                                    <TableRow
                                                        ref={dragProvided.innerRef}
                                                        {...dragProvided.draggableProps}
                                                        data-testid='property-field-row'
                                                    >
                                                        {row.getVisibleCells().map((cell) => (
                                                            <TableCell
                                                                key={cell.id}
                                                                style={{width: cell.column.getSize()}}
                                                                {...(cell.column.id === 'drag' ? dragProvided.dragHandleProps : {})}
                                                            >
                                                                {flexRender(
                                                                    cell.column.columnDef.cell,
                                                                    cell.getContext()
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </TableBody>
                                </Table>
                            )}
                        </Droppable>
                    </DragDropContext>
                </TableContainer>

                <AddPropertyButton
                    onClick={addProperty}
                    disabled={properties.length >= MAX_PROPERTIES_LIMIT}
                    title={properties.length >= MAX_PROPERTIES_LIMIT ? formatMessage({defaultMessage: 'Maximum of {limit} attributes allowed'}, {limit: MAX_PROPERTIES_LIMIT}) : undefined}
                >
                    <i className='icon-plus'/>
                    {properties.length >= MAX_PROPERTIES_LIMIT ? (
                        <FormattedMessage
                            defaultMessage='Maximum attributes reached ({limit})'
                            values={{limit: MAX_PROPERTIES_LIMIT}}
                        />
                    ) : (
                        <FormattedMessage defaultMessage='Add attribute'/>
                    )}
                </AddPropertyButton>

                {deletingProperty && (
                    <GenericModal
                        id='confirm-property-delete-modal'
                        modalHeaderText={<FormattedMessage defaultMessage='Delete Attribute'/>}
                        show={Boolean(deletingProperty)}
                        onHide={() => setDeletingProperty(null)}
                        handleConfirm={async () => {
                            const success = await deleteProperty(deletingProperty.id);
                            if (success) {
                                setDeletingProperty(null);
                            }
                        }}
                        handleCancel={() => setDeletingProperty(null)}
                        confirmButtonText={<FormattedMessage defaultMessage='Delete'/>}
                        cancelButtonText={<FormattedMessage defaultMessage='Cancel'/>}
                        isConfirmDestructive={true}
                    >
                        <p>
                            <FormattedMessage
                                defaultMessage='Are you sure you want to delete the attribute "{propertyName}"? This action cannot be undone.'
                                values={{
                                    propertyName: deletingProperty.name,
                                }}
                            />
                        </p>
                    </GenericModal>
                )}
            </InnerContainer>
        </OuterContainer>
    );
};

const OuterContainer = styled.div`
    height: 100%;
    grid-area: aside / aside / aside-right / aside-right;
`;

const InnerContainer = styled.div`
    display: flex;
    max-width: 1120px;
    flex-direction: column;
    background: var(--center-channel-bg);
    border-radius: 8px;
    padding: 28px 32px;
    margin: 5rem auto;
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);

    > div + div {
        margin-top: 16px;
    }
`;

const TableContainer = styled.div`
    background: var(--center-channel-bg);
    overflow: hidden;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
`;

const TableHeader = styled.thead`
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
`;

const TableBody = styled.tbody`
    /* No additional styling needed */
`;

const TableRow = styled.tr`
    height: 40px;

    &:not(:last-child) {
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    }

    tbody &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

const TableHeaderCell = styled.th`
    padding: 12px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    letter-spacing: 0.02em;

    &:first-child {
        padding: 0;
    }
`;

const TableCell = styled.td`
    padding: 0;
    vertical-align: middle;
`;

const DragHandle = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    height: 100%;
    width: 18px;

    &:hover {
        color: var(--center-channel-color);
    }

    &:active {
        cursor: grabbing;
    }

    i {
        font-size: 16px;
    }
`;

const PropertyCellContent = styled.div`
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0 10px;
    gap: 2px;
`;

const HeaderColEnd = styled.div`
    display: inline-block;
    width: 100%;
    text-align: right;
`;

const TypeIconButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 0;
    width: 40px;
    height: 40px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    }
`;

const AddPropertyButton = styled.button`
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: var(--button-bg);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 12px;
    margin-top: 16px;
    align-self: flex-start;
    border-radius: 4px;

    &:hover:not(:disabled) {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active:not(:disabled) {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
        cursor: not-allowed;
    }

    i {
        margin-right: 8px;
        font-size: 14px;
    }
`;

export default styled(PlaybookProperties)`/* stylelint-disable no-empty-source */`;
