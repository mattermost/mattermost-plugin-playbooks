// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import ReactSelect, {StylesConfig} from 'react-select';
import {defineMessages, useIntl} from 'react-intl';

import {
    AccountOutlineIcon,
    CheckIcon,
    ChevronDownCircleOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    MenuVariantIcon,
} from '@mattermost/compass-icons/components';
import {FieldType} from '@mattermost/types/properties';

import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import type {PropertyField} from 'src/types/properties';

import Dropdown from 'src/components/dropdown';

import {hasOptions, supportsOptions} from './property_utils';

interface Props {
    field: PropertyField;
    updateField: (field: PropertyField) => void | Promise<void>;
    onClose?: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    target: React.ReactElement;
}

type PropertyType = 'text' | 'select' | 'multiselect' | 'url' | 'user';

type TypeOption = {
    value: PropertyType;
    label: JSX.Element;
    type: PropertyType;
};

const propertyTypeMessages = defineMessages({
    text: {id: 'playbook.property_type.text', defaultMessage: 'Text'},
    url: {id: 'playbook.property_type.url', defaultMessage: 'URL'},
    select: {id: 'playbook.property_type.select', defaultMessage: 'Select'},
    multiselect: {id: 'playbook.property_type.multiselect', defaultMessage: 'Multi-select'},
    user: {id: 'playbook.property_type.user', defaultMessage: 'User'},
    defaultOptionName: {id: 'playbook.property_type.default_option_name', defaultMessage: 'Option 1'},
});

const PROPERTY_TYPE_DEFS: Array<{
    type: PropertyType;
    icon: React.ComponentType<{size?: number}>;
}> = [
    {type: 'text', icon: MenuVariantIcon},
    {type: 'url', icon: LinkVariantIcon},
    {type: 'select', icon: ChevronDownCircleOutlineIcon},
    {type: 'multiselect', icon: FormatListBulletedIcon},
    {type: 'user', icon: AccountOutlineIcon},
];

const PropertyTypeSelector = ({
    field,
    updateField,
    onClose,
    isOpen,
    onOpenChange,
    target,
}: Props) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;

    const TYPE_OPTIONS = React.useMemo(() => PROPERTY_TYPE_DEFS.map(({type, icon}) => ({
        type,
        icon,
        label: formatMessage(propertyTypeMessages[type]),
    })), [formatMessage]);
    const handleTypeSelect = (option: TypeOption | null | undefined) => {
        if (!option) {
            return;
        }

        let actualType: FieldType = 'text';
        let valueType: string | undefined = field.attrs?.value_type;

        switch (option.type) {
        case 'url':
            actualType = 'text';
            valueType = 'url';
            break;
        case 'text':
            actualType = 'text';
            valueType = '';
            break;
        case 'select':
            actualType = 'select';
            valueType = '';
            break;
        case 'multiselect':
            actualType = 'multiselect';
            valueType = '';
            break;
        case 'user':
            actualType = 'user';
            valueType = '';
            break;
        }

        const nextField = {...field, type: actualType, attrs: {...(field.attrs || {}), value_type: valueType}};

        if (!supportsOptions(nextField) && hasOptions(nextField)) {
            // Remove options if not supported
            nextField.attrs = {...nextField.attrs || {}};
            Reflect.deleteProperty(nextField.attrs, 'options');
        } else if (supportsOptions(nextField) && !hasOptions(nextField)) {
            // Add default option if supported and none exist
            nextField.attrs = {
                ...nextField.attrs,
                options: [{
                    id: '',
                    name: formatMessage(propertyTypeMessages.defaultOptionName),
                }],
            };
        }

        Promise.resolve(updateField(nextField)).catch(() => {
            addToast({
                content: formatMessage({defaultMessage: 'Failed to update attribute type'}),
                toastStyle: ToastStyle.Failure,
            });
        });
        onClose?.();
        onOpenChange(false);
    };

    const typeOptions: TypeOption[] = TYPE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isSelected = option.type === 'url' ? field.type === 'text' && field.attrs?.value_type === 'url' : option.type === field.type && (!field.attrs?.value_type || field.attrs.value_type === '');

        return {
            value: option.type,
            type: option.type,
            label: (
                <ItemContent>
                    <ItemLeft>
                        <Icon size={18}/>
                        {option.label}
                    </ItemLeft>
                    {isSelected && (
                        <CheckIcon
                            size={16}
                            color='var(--button-bg)'
                        />
                    )}
                </ItemContent>
            ),
        };
    });

    const selectedOption = typeOptions.find((option) => {
        if (option.type === 'url') {
            return field.type === 'text' && field.attrs?.value_type === 'url';
        }
        return option.type === field.type && (!field.attrs?.value_type || field.attrs.value_type === '');
    });

    return (
        <Dropdown
            target={target}
            placement='bottom-start'
            isOpen={isOpen}
            onOpenChange={onOpenChange}
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
                onChange={handleTypeSelect}
                classNamePrefix='playbook-react-select'
                className='playbook-react-select'
            />
        </Dropdown>
    );
};

const ItemContent = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const ItemLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    span {
        font-size: 14px;
        color: var(--center-channel-color);
    }
`;

const selectStyles: StylesConfig<TypeOption, false> = {
    control: (provided) => ({...provided, minWidth: 140, margin: 8}),
    menu: () => ({boxShadow: 'none'}),
    option: (provided, state) => {
        const hoverColor = 'rgba(var(--button-bg-rgb), 0.08)';
        const bgHover = state.isFocused ? hoverColor : 'transparent';
        return {
            ...provided,
            backgroundColor: state.isSelected ? hoverColor : bgHover,
            color: 'unset',
        };
    },
};

export default PropertyTypeSelector;
