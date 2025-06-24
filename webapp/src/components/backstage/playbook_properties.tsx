// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */ // TODO: Remove console statements when implementing actual server calls

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
import {useIntl} from 'react-intl';
import {ChevronDownCircleOutlineIcon, FormatListBulletedIcon, MenuVariantIcon} from '@mattermost/compass-icons/components';

import {usePlaybookViewTelemetry} from 'src/hooks/telemetry';
import {PlaybookViewTarget} from 'src/types/telemetry';
import {PropertyField} from 'src/types/property_field';

import GenericModal from 'src/components/widgets/generic_modal';

import PropertyValuesInput from './playbook_properties/property_values_input';
import PropertyDotMenu from './playbook_properties/property_dot_menu';
import SimpleTypeSelector from './playbook_properties/simple_type_selector';
import EmptyState from './playbook_properties/empty_state';
import PropertyNameInput, {PropertyNameInputRef} from './playbook_properties/property_name_input';

interface Props {
    playbookID: string;
}

const PlaybookProperties = ({playbookID}: Props) => {
    const {formatMessage} = useIntl();
    usePlaybookViewTelemetry(PlaybookViewTarget.Properties, playbookID);

    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [deletingProperty, setDeletingProperty] = useState<PropertyField | null>(null);
    const nameInputRefs = useRef<{[key: string]: PropertyNameInputRef | null}>({});

    // Test data - in real implementation this would come from GraphQL
    const [properties, setProperties] = useState<PropertyField[]>([
        {
            id: '1',
            group_id: 'playbooks',
            name: 'Priority',
            type: 'select',
            attrs: {
                visibility: 'always',
                sort_order: 1,
                options: [
                    {id: 'opt1', name: 'High', color: '#ff0000'},
                    {id: 'opt2', name: 'Medium', color: '#ffaa00'},
                    {id: 'opt3', name: 'Low', color: '#00aa00'},
                ],
            },
            target_id: playbookID,
            target_type: 'playbook',
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
        },
        {
            id: '2',
            group_id: 'playbooks',
            name: 'Description',
            type: 'text',
            attrs: {
                visibility: 'when_set',
                sort_order: 2,
            },
            target_id: playbookID,
            target_type: 'playbook',
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
        },
    ]);

    const updateProperty = useCallback((updatedProperty: PropertyField) => {
        console.debug('Would call server update attribute', updatedProperty);

        setProperties((prev) =>
            prev.map((prop) =>
                (prop.id === updatedProperty.id ? updatedProperty : prop)
            )
        );
    }, []);

    const deleteProperty = useCallback((propertyId: string) => {
        console.debug('Would call server delete attribute', propertyId);

        setProperties((prev) => prev.filter((prop) => prop.id !== propertyId));
    }, []);

    const addProperty = useCallback(() => {
        const existingIds = properties.map((p) => parseInt(p.id, 10)).filter(Boolean);
        const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
        const newId = (maxId + 1).toString();

        const newProperty: PropertyField = {
            id: newId,
            group_id: 'playbooks',
            name: formatMessage({
                defaultMessage: 'Attribute {count}',
            }, {count: properties.length + 1}),
            type: 'text',
            attrs: {
                visibility: 'when_set',
                sort_order: properties.length + 1,
            },
            target_id: playbookID,
            target_type: 'playbook',
            create_at: Date.now(),
            update_at: Date.now(),
            delete_at: 0,
        };

        console.debug('Would call server create attribute', newProperty);
        setProperties((prev) => [...prev, newProperty]);
    }, [properties, formatMessage, playbookID]);

    const handleDragEnd = useCallback((result: any) => {
        if (!result.destination) {
            return;
        }

        const reorderedProperties = Array.from(properties);
        const [removed] = reorderedProperties.splice(result.source.index, 1);
        reorderedProperties.splice(result.destination.index, 0, removed);

        // Update sort_order for all properties
        const updatedProperties = reorderedProperties.map((prop, index) => ({
            ...prop,
            attrs: {
                ...prop.attrs,
                sort_order: index + 1,
            },
        }));

        console.debug('Would call server update attribute order', updatedProperties);
        setProperties(updatedProperties);
    }, [properties]);

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
                header: formatMessage({
                    defaultMessage: 'Attribute',
                }),
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
                header: formatMessage({
                    defaultMessage: 'Values',
                }),
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
                header: '',
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
                        onDuplicate={(field) => {
                            const duplicatedField = {
                                ...field,
                                id: (Math.max(...properties.map((p) => parseInt(p.id, 10)).filter(Boolean)) + 1).toString(),
                                name: `${field.name} Copy`,
                            };
                            console.debug('Would call server create attribute', duplicatedField);
                            setProperties((prev) => [...prev, duplicatedField]);
                        }}
                    />
                ),
            }),
        ],
        [columnHelper, formatMessage, updateProperty, deleteProperty, properties, setProperties, editingTypeId]
    );

    const table = useReactTable({
        data: properties,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (properties.length === 0) {
        return (
            <OuterContainer>
                <InnerContainer>
                    <EmptyState
                        title={formatMessage({
                            defaultMessage: 'No attributes yet',
                        })}
                        description={formatMessage({
                            defaultMessage: 'Add custom attributes to capture additional information about your playbook runs.',
                        })}
                        buttonText={formatMessage({
                            defaultMessage: 'Add your first attribute',
                        })}
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
                    {formatMessage({
                        defaultMessage: 'Add attribute',
                    })}
                </AddPropertyButton>

                {deletingProperty && (
                    <GenericModal
                        id='confirm-property-delete-modal'
                        modalHeaderText={formatMessage({
                            defaultMessage: 'Delete Attribute',
                        })}
                        show={Boolean(deletingProperty)}
                        onHide={() => setDeletingProperty(null)}
                        handleConfirm={() => {
                            deleteProperty(deletingProperty.id);
                            setDeletingProperty(null);
                        }}
                        handleCancel={() => setDeletingProperty(null)}
                        confirmButtonText={formatMessage({
                            defaultMessage: 'Delete',
                        })}
                        cancelButtonText={formatMessage({
                            defaultMessage: 'Cancel',
                        })}
                        isConfirmDestructive={true}
                    >
                        <p>
                            {formatMessage({
                                defaultMessage: 'Are you sure you want to delete the attribute "{propertyName}"? This action cannot be undone.',
                            }, {
                                propertyName: deletingProperty.name,
                            })}
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
    width: 100%;
    max-width: 18px;
    min-height: 48px;

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
    min-height: 48px;
    padding: 12px 16px;
    gap: 12px;
`;

const TypeIconButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
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