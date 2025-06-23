// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType, useMemo, useState} from 'react';
import {
    FormattedMessage,
    type MessageDescriptor,
    defineMessage,
    useIntl,
} from 'react-intl';
import styled from 'styled-components';
import ReactSelect, {StylesConfig} from 'react-select';

import {
    CheckIcon,
    ChevronDownCircleOutlineIcon,
    FormatListBulletedIcon,
    MenuVariantIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import type {PropertyField} from 'src/types/property_field';
import GenericModal from 'src/components/widgets/generic_modal';
import Dropdown from 'src/components/dropdown';

interface Props {
    field: PropertyField;
    updateField: (field: PropertyField) => void;
}

type TypeID = 'text' | 'select' | 'multiselect';

type TypeDescriptor = {
    id: TypeID;
    fieldType: string;
    icon: ComponentType<IconProps>;
    label: MessageDescriptor;
};

type TypeOption = {
    value: string;
    label: JSX.Element;
    descriptor: TypeDescriptor;
};

const TYPE_DESCRIPTOR: Record<TypeID, TypeDescriptor> = {
    text: {
        id: 'text',
        fieldType: 'text',
        icon: MenuVariantIcon,
        label: defineMessage({
            id: 'playbook.properties.type.text',
            defaultMessage: 'Text',
        }),
    },
    select: {
        id: 'select',
        fieldType: 'select',
        icon: ChevronDownCircleOutlineIcon,
        label: defineMessage({
            id: 'playbook.properties.type.select',
            defaultMessage: 'Select',
        }),
    },
    multiselect: {
        id: 'multiselect',
        fieldType: 'multiselect',
        icon: FormatListBulletedIcon,
        label: defineMessage({
            id: 'playbook.properties.type.multiselect',
            defaultMessage: 'Multi-select',
        }),
    },
};

const PropertyTypeMenu = (props: Props) => {
    const {formatMessage} = useIntl();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingTypeDescriptor, setPendingTypeDescriptor] = useState<TypeDescriptor | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleTypeChange = (descriptor: TypeDescriptor) => {
        setIsOpen(false);

        // Check if switching to text and we have existing options
        const hasExistingOptions = props.field.attrs.options && props.field.attrs.options.length > 0;
        const isChangingToText = descriptor.fieldType === 'text';
        const isCurrentlySelectType = props.field.type === 'select' || props.field.type === 'multiselect';

        if (isChangingToText && isCurrentlySelectType && hasExistingOptions) {
            // Show confirmation modal
            setPendingTypeDescriptor(descriptor);
            setShowConfirmModal(true);
            return;
        }

        // Safe to change immediately
        applyTypeChange(descriptor);
    };

    const applyTypeChange = (descriptor: TypeDescriptor) => {
        const updatedField = {...props.field, type: descriptor.fieldType};

        // Manage attrs.options based on field type
        if (descriptor.fieldType === 'text') {
            // Remove options for text fields
            delete updatedField.attrs.options;
        } else if (descriptor.fieldType === 'select' || descriptor.fieldType === 'multiselect') {
            // Ensure options array exists for select/multiselect and create initial option
            if (!updatedField.attrs.options || updatedField.attrs.options.length === 0) {
                updatedField.attrs = {
                    ...updatedField.attrs,
                    options: [
                        {
                            id: `option-${Date.now()}`,
                            name: formatMessage({
                                id: 'playbook.properties.option.default_name',
                                defaultMessage: 'Option 1',
                            }),
                        },
                    ],
                };
            }
        }

        props.updateField(updatedField);
    };

    const handleConfirmTypeChange = () => {
        if (pendingTypeDescriptor) {
            applyTypeChange(pendingTypeDescriptor);
        }
        setShowConfirmModal(false);
        setPendingTypeDescriptor(null);
    };

    const handleCancelTypeChange = () => {
        setShowConfirmModal(false);
        setPendingTypeDescriptor(null);
    };

    const currentTypeDescriptor = useMemo(() => {
        return getTypeDescriptor(props.field);
    }, [props.field]);

    const typeOptions = useMemo(() => {
        return Object.values(TYPE_DESCRIPTOR).map((descriptor) => {
            const Icon = descriptor.icon;
            return {
                value: descriptor.id,
                label: (
                    <TypeOptionContent>
                        <TypeOptionLeft>
                            <Icon size={16}/>
                            <FormattedMessage {...descriptor.label}/>
                        </TypeOptionLeft>
                        {descriptor.id === currentTypeDescriptor.id && (
                            <CheckIcon
                                size={16}
                                color='var(--button-bg, #1c58d9)'
                            />
                        )}
                    </TypeOptionContent>
                ),
                descriptor,
            };
        });
    }, [currentTypeDescriptor]);

    const selectedOption = typeOptions.find((option) => option.value === currentTypeDescriptor.id);
    const CurrentTypeIcon = currentTypeDescriptor.icon;

    const target = (
        <TypeButton onClick={() => setIsOpen(!isOpen)}>
            <CurrentTypeIcon
                size={16}
                color='rgba(var(--center-channel-color-rgb), 0.64)'
            />
            <FormattedMessage {...currentTypeDescriptor.label}/>
        </TypeButton>
    );

    return (
        <>
            <TypeMenuContainer>
                <Dropdown
                    target={target}
                    placement='bottom-start'
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                >
                    <ReactSelect
                        autoFocus={true}
                        backspaceRemovesValue={false}
                        components={{DropdownIndicator: null, IndicatorSeparator: null}}
                        controlShouldRenderValue={false}
                        hideSelectedOptions={false}
                        menuIsOpen={true}
                        options={typeOptions}
                        placeholder={formatMessage({defaultMessage: 'Select type'})}
                        styles={selectStyles}
                        tabSelectsValue={false}
                        value={selectedOption}
                        onChange={(option) => {
                            if (option) {
                                handleTypeChange(option.descriptor);
                            }
                        }}
                        classNamePrefix='playbook-react-select'
                        className='playbook-react-select'
                    />
                </Dropdown>
            </TypeMenuContainer>
            {showConfirmModal && (
                <GenericModal
                    id='confirm-type-change-modal'
                    modalHeaderText={
                        <FormattedMessage
                            id='playbook.properties.type.confirm_change.title'
                            defaultMessage='Confirm Type Change'
                        />
                    }
                    show={showConfirmModal}
                    onHide={handleCancelTypeChange}
                    handleConfirm={handleConfirmTypeChange}
                    handleCancel={handleCancelTypeChange}
                    confirmButtonText={
                        <FormattedMessage
                            id='playbook.properties.type.confirm_change.confirm'
                            defaultMessage='Change to Text'
                        />
                    }
                    cancelButtonText={
                        <FormattedMessage
                            id='playbook.properties.type.confirm_change.cancel'
                            defaultMessage='Cancel'
                        />
                    }
                    isConfirmDestructive={true}
                >
                    <p>
                        <FormattedMessage
                            id='playbook.properties.type.confirm_change.warning'
                            defaultMessage='Changing this property to Text will permanently delete all existing values ({optionCount, plural, one {# option} other {# options}}). This action cannot be undone.'
                            values={{
                                optionCount: props.field.attrs.options?.length || 0,
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='playbook.properties.type.confirm_change.question'
                            defaultMessage='Are you sure you want to continue?'
                        />
                    </p>
                </GenericModal>
            )}
        </>
    );
};

const getTypeDescriptor = (field: PropertyField): TypeDescriptor => {
    for (const descriptor of Object.values(TYPE_DESCRIPTOR)) {
        if (descriptor.fieldType === field.type) {
            return descriptor;
        }
    }

    return TYPE_DESCRIPTOR.text;
};

const TypeMenuContainer = styled.div`
    width: 100%;
    height: 100%;
`;

const TypeButton = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    text-transform: capitalize;
    height: 100%;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background-color: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    cursor: pointer;
    
    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const TypeOptionContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    width: 100%;
`;

const TypeOptionLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const selectStyles: StylesConfig<TypeOption, false> = {
    control: (provided) => ({...provided, minWidth: 180, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(20, 93, 191, 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export default PropertyTypeMenu;
