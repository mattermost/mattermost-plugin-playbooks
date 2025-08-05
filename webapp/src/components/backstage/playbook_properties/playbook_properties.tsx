// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import {FormattedMessage, useIntl} from 'react-intl';
import {ChevronDownCircleOutlineIcon, FormatListBulletedIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';

import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';
import {
    FullPlaybook,
    PlaybookPropertyField as GraphQLPropertyField,
    useAddPlaybookPropertyField,
    useDeletePlaybookPropertyField,
    usePlaybook,
    useUpdatePlaybookPropertyField,
} from 'src/graphql/hooks';
import {PropertyFieldInput, PropertyFieldType} from 'src/graphql/generated/graphql';
import {PropertyField} from 'src/types/property_field';

import GenericModal from 'src/components/widgets/generic_modal';

import PropertyValuesInput from './property_values_input';
import PropertyDotMenu from './property_dot_menu';
import SimpleTypeSelector from './simple_type_selector';
import EmptyState from './empty_state';
import PropertyNameInput, {PropertyNameInputRef} from './property_name_input';

interface Props {
    playbookID: string;
}

const toPropertyField = (gqlField: GraphQLPropertyField, playbookID: string): PropertyField => {
    return {...gqlField, target_type: 'playbook', target_id: playbookID} as PropertyField;
};

const usePlaybookPropertyFields = (playbook: Maybe<FullPlaybook>): PropertyField[] => {
    return useMemo(() => {
        if (!playbook || !playbook.propertyFields) {
            return [];
        }
        return playbook.propertyFields.map((field) => toPropertyField(field, playbook.id));
    }, [playbook]);
};

const PlaybookProperties = ({playbookID}: Props) => {
    const {formatMessage} = useIntl();
    usePlaybookViewTelemetry(PlaybookViewTarget.Properties, playbookID);

    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [deletingProperty, setDeletingProperty] = useState<PropertyField | null>(null);
    const nameInputRefs = useRef<{[key: string]: PropertyNameInputRef | null}>({});

    const [playbook, playbookResult] = usePlaybook(playbookID);
    const [addPropertyField] = useAddPlaybookPropertyField();
    const [updatePropertyField] = useUpdatePlaybookPropertyField();
    const [deletePropertyField] = useDeletePlaybookPropertyField();

    const properties = usePlaybookPropertyFields(playbook);

    const updateProperty = useCallback(async (updatedProperty: PropertyField) => {
        try {
            const propertyFieldInput: PropertyFieldInput = {
                name: updatedProperty.name,
                type: updatedProperty.type as PropertyFieldType,
                attrs: {
                    visibility: updatedProperty.attrs.visibility,
                    sortOrder: updatedProperty.attrs.sort_order,
                    options: updatedProperty.attrs.options,
                },
            };

            await updatePropertyField(playbookID, updatedProperty.id, propertyFieldInput);
        } catch (error) {
            console.error('Failed to update property field:', error);
        }
    }, [updatePropertyField, playbookID]);

    const deleteProperty = useCallback(async (propertyId: string) => {
        try {
            await deletePropertyField(playbookID, propertyId);
        } catch (error) {
            console.error('Failed to delete property field:', error);
        }
    }, [deletePropertyField, playbookID]);

    const addProperty = useCallback(async () => {
        try {
            const newPropertyField: PropertyFieldInput = {
                name: `Attribute ${properties.length + 1}`,
                type: PropertyFieldType.Text,
                attrs: {
                    visibility: 'when_set',
                    sortOrder: properties.length + 1,
                },
            };

            await addPropertyField(playbookID, newPropertyField);
        } catch (error) {
            console.error('Failed to add property field:', error);
        }
    }, [addPropertyField, playbookID, properties.length]);

    const handleDragEnd = useCallback(async (result: any) => {
        if (!result.destination) {
            return;
        }

        const reorderedProperties = Array.from(properties);
        const [removed] = reorderedProperties.splice(result.source.index, 1);
        reorderedProperties.splice(result.destination.index, 0, removed);

        try {
            const updatePromises = reorderedProperties.map(async (prop, index) => {
                const updatedProperty = {
                    ...prop,
                    attrs: {
                        ...prop.attrs,
                        sort_order: index + 1,
                    },
                };

                const propertyFieldInput: PropertyFieldInput = {
                    name: updatedProperty.name,
                    type: updatedProperty.type as PropertyFieldType,
                    attrs: {
                        visibility: updatedProperty.attrs.visibility,
                        sortOrder: updatedProperty.attrs.sort_order,
                        options: updatedProperty.attrs.options,
                    },
                };

                return updatePropertyField(playbookID, updatedProperty.id, propertyFieldInput);
            });

            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Failed to update property field order:', error);
        }
    }, [properties, updatePropertyField, playbookID]);

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
                            return <MenuVariantIcon size={16}/>;
                        case 'select':
                            return <ChevronDownCircleOutlineIcon size={16}/>;
                        case 'multiselect':
                            return <FormatListBulletedIcon size={16}/>;
                        default:
                            return <MenuVariantIcon size={16}/>;
                        }
                    };

                    const target = (
                        <TypeIconButton onClick={() => setEditingTypeId(info.row.original.id)}>
                            <TypeIcon/>
                        </TypeIconButton>
                    );

                    return (
                        <PropertyCellContent>
                            {editingTypeId === info.row.original.id ? (
                                <SimpleTypeSelector
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
                    <FormattedMessage defaultMessage='Actions'/>
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
                            try {
                                const duplicatedPropertyField: PropertyFieldInput = {
                                    name: `${field.name} Copy`,
                                    type: field.type as PropertyFieldType,
                                    attrs: {
                                        visibility: field.attrs.visibility,
                                        sortOrder: properties.length + 1,
                                        options: field.attrs.options,
                                    },
                                };

                                await addPropertyField(playbookID, duplicatedPropertyField);
                            } catch (error) {
                                console.error('Failed to duplicate property field:', error);
                            }
                        }}
                    />
                ),
            }),
        ],
        [columnHelper, formatMessage, updateProperty, deleteProperty, properties, editingTypeId]
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
                    <div>Loading...</div>
                </InnerContainer>
            </OuterContainer>
        );
    }

    if (playbookResult.error || !playbook) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <div>Error loading playbook properties. Please try again.</div>
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

                <AddPropertyButton onClick={addProperty}>
                    <i className='icon-plus'/>
                    <FormattedMessage defaultMessage='Add attribute'/>
                </AddPropertyButton>

                {deletingProperty && (
                    <GenericModal
                        id='confirm-property-delete-modal'
                        modalHeaderText={<FormattedMessage defaultMessage='Delete Attribute'/>}
                        show={Boolean(deletingProperty)}
                        onHide={() => setDeletingProperty(null)}
                        handleConfirm={() => {
                            deleteProperty(deletingProperty.id);
                            setDeletingProperty(null);
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
    text-transform: uppercase;
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

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    &:active {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        margin-right: 8px;
        font-size: 14px;
    }
`;

export default styled(PlaybookProperties)`/* stylelint-disable no-empty-source */`;
