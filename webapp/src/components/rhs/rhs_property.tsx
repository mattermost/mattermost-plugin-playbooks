// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {PropertyField, PropertyValue} from 'src/types/properties';

import {useSetRunPropertyValue} from 'src/graphql/hooks';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';

import TextProperty from './properties/property_text';
import SelectProperty from './properties/property_select';
import MultiselectProperty from './properties/property_multiselect';
import UserProperty, {MultiuserProperty} from './properties/property_user';
import DateProperty from './properties/property_date';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
}

const RHSProperty = (props: Props) => {
    const [setRunPropertyValue] = useSetRunPropertyValue();
    const addToast = useToaster().add;
    const {formatMessage} = useIntl();
    const handleValueChange = useCallback((newValue: string | string[] | null): Promise<void> => {
        const fallbackMessage = formatMessage({id: 'playbooks.rhs_property.update_error', defaultMessage: 'Failed to update property value.'});
        return setRunPropertyValue(props.runID, props.field.id, newValue).then(
            (result) => {
                if (result.errors?.length) {
                    addToast({content: fallbackMessage, toastStyle: ToastStyle.Failure});
                    throw new Error(fallbackMessage);
                }
            },
            () => {
                addToast({content: fallbackMessage, toastStyle: ToastStyle.Failure});
                throw new Error(fallbackMessage);
            },
        );
    }, [setRunPropertyValue, props.runID, props.field.id, addToast, formatMessage]);

    const renderPropertyComponent = () => {
        const commonProps = {
            field: props.field,
            value: props.value,
            runID: props.runID,
        };

        switch (props.field.type) {
        case 'text':
            return (
                <TextProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'select':
            return (
                <SelectProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'multiselect':
            return (
                <MultiselectProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'user':
            return (
                <UserProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'multiuser':
            return (
                <MultiuserProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'date':
            return (
                <DateProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        default:
            return null;
        }
    };

    return (
        <PropertyRow data-testid={`run-property-${props.field.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <PropertyLabel>{props.field.name}</PropertyLabel>
            {renderPropertyComponent()}
        </PropertyRow>
    );
};

const PropertyRow = styled.div`
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    padding: 0 8px;
    margin-bottom: 12px;
`;

const PropertyLabel = styled.div`
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    min-width: 120px;
    margin-right: 12px;
`;

export default RHSProperty;
