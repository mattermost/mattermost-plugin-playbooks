// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {DateTime} from 'luxon';
import {GlobalState} from '@mattermost/types/store';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUsers} from 'mattermost-redux/selectors/entities/common';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {type PropertyField, PropertyFieldType, type PropertyValue} from 'src/types/properties';
import {useClickOutsideRef, useEnsureProfiles} from 'src/hooks';
import {parsePropertyDate} from 'src/components/rhs/properties/property_date';

export const ATTRIBUTE_COLUMNS_STORAGE_KEY = 'playbook_runs_attribute_columns';

const sortBySortOrder = (a: PropertyField, b: PropertyField) => (a.attrs?.sort_order ?? 0) - (b.attrs?.sort_order ?? 0);

// Returns the stable playbook-level identifier for a property field.
// Run-level fields get unique IDs when copied from the playbook, but share
// the same parent_id. Column selection must use parent_id so it works
// across all runs from the same playbook.
export const stableFieldId = (f: PropertyField): string => f.attrs?.parent_id ?? f.id;

export const DEFAULT_MAX_COLUMNS = 2;

interface Props {
    propertyFields?: PropertyField[];
    propertyValues?: PropertyValue[];
    selectedFieldIds?: string[];
}

const AttributeColumns = ({propertyFields, propertyValues, selectedFieldIds}: Props) => {
    const nameDisplaySetting = useSelector<GlobalState, string | undefined>(getTeammateNameDisplaySetting) ?? '';
    const usersMap = useSelector(getUsers);

    const userIdsToFetch = useMemo(() => {
        if (!propertyFields || !propertyValues) {
            return [];
        }
        const userFieldIds = new Set(
            propertyFields
                .filter((f) => f.type === PropertyFieldType.User || f.type === PropertyFieldType.Multiuser)
                .map((f) => f.id),
        );
        const ids: string[] = [];
        for (const pv of propertyValues) {
            if (!userFieldIds.has(pv.field_id) || pv.value == null) {
                continue;
            }
            if (Array.isArray(pv.value)) {
                ids.push(...(pv.value as string[]));
            } else {
                ids.push(String(pv.value));
            }
        }
        return ids;
    }, [propertyFields, propertyValues]);

    useEnsureProfiles(userIdsToFetch);

    const propertyValuesMap = useMemo(
        () => Object.fromEntries((propertyValues ?? []).map((pv) => [pv.field_id, pv])),
        [propertyValues],
    );

    const getValueForField = useCallback((field: PropertyField): string => {
        const pv = propertyValuesMap[field.id];
        if (pv == null) {
            return '—';
        }
        const val = pv.value;
        if (val == null) {
            return '—';
        }

        // For user fields, resolve user ID to display name
        if (field.type === PropertyFieldType.User) {
            const userId = String(val);
            const user = usersMap[userId];
            return user ? displayUsername(user, nameDisplaySetting) : userId;
        }

        // For multi-user fields, resolve each user ID to display name
        if (field.type === PropertyFieldType.Multiuser && Array.isArray(val)) {
            const names = (val as string[]).map((uid) => {
                const u = usersMap[uid];
                return u ? displayUsername(u, nameDisplaySetting) : uid;
            });
            return names.length > 0 ? names.join(', ') : '—';
        }

        // For date fields, parse and format with locale-aware date
        if (field.type === PropertyFieldType.Date) {
            const millis = parsePropertyDate(val as string | number | undefined);
            if (millis > 0) {
                return DateTime.fromMillis(millis).toLocaleString(DateTime.DATE_MED);
            }
            return '—';
        }

        // For select/multiselect fields, resolve option name(s) from option ID(s)
        if (field.attrs?.options && Array.isArray(field.attrs.options)) {
            const options = field.attrs.options as Array<{id: string; name: string}>;
            if (field.type === PropertyFieldType.Multiselect && Array.isArray(val)) {
                const names = (val as string[])
                    .map((id) => options.find((o) => o.id === id)?.name)
                    .filter((n): n is string => Boolean(n));
                return names.length > 0 ? names.join(', ') : '—';
            }
            if (field.type === PropertyFieldType.Select) {
                const option = options.find((o) => o.id === String(val));
                if (option) {
                    return option.name;
                }
            }
        }

        return String(val);
    }, [propertyValuesMap, usersMap, nameDisplaySetting]);

    const sortedFields = useMemo(
        () => [...(propertyFields ?? [])].sort(sortBySortOrder),
        [propertyFields],
    );

    if (!propertyFields || propertyFields.length === 0) {
        return null;
    }

    // undefined = no explicit selection (show first N defaults)
    // string[] = explicit user selection (show exactly those, even if empty)
    const displayFields = selectedFieldIds === undefined ?
        sortedFields.slice(0, DEFAULT_MAX_COLUMNS) :
        sortedFields.filter((f) => selectedFieldIds.includes(stableFieldId(f)));

    return (
        <Wrapper data-testid='run-list-item-attributes'>
            <AttributeRow>
                {displayFields.map((field) => (
                    <AttributeCell
                        key={field.id}
                        data-testid={`attribute-col-${field.id}`}
                    >
                        <FieldName>{field.name}</FieldName>
                        <FieldValue>{getValueForField(field)}</FieldValue>
                    </AttributeCell>
                ))}
            </AttributeRow>
        </Wrapper>
    );
};

export default AttributeColumns;

interface ConfigureProps {
    propertyFields: PropertyField[];
    selectedFieldIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export const AttributeColumnsConfig = ({propertyFields, selectedFieldIds, onSelectionChange}: ConfigureProps) => {
    const {formatMessage} = useIntl();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useClickOutsideRef(wrapperRef, () => setDropdownOpen(false));

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setDropdownOpen(false);
        }
    }, []);

    const sortedFields = useMemo(
        () => [...propertyFields].sort(sortBySortOrder),
        [propertyFields],
    );

    const handleColumnToggle = useCallback((sid: string) => {
        const next = selectedFieldIds.includes(sid) ?
            selectedFieldIds.filter((id) => id !== sid) :
            [...selectedFieldIds, sid];
        onSelectionChange(next);
    }, [selectedFieldIds, onSelectionChange]);

    return (
        <ConfigWrapper
            ref={wrapperRef}
            onKeyDown={handleKeyDown}
        >
            <ConfigureButton
                data-testid='configure-columns-button'
                aria-expanded={dropdownOpen}
                aria-haspopup='menu'
                onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((o) => !o);
                }}
            >
                {formatMessage({id: 'playbooks.attribute_columns.configure_columns', defaultMessage: 'Configure columns'})}
            </ConfigureButton>
            {dropdownOpen && (
                <DropdownPanel
                    data-testid='column-selector-dropdown'
                    role='menu'
                    aria-label={formatMessage({id: 'playbooks.attribute_columns.column_menu', defaultMessage: 'Column selection'})}
                >
                    {sortedFields.map((field) => {
                        const sid = stableFieldId(field);
                        const isSelected = selectedFieldIds.includes(sid);
                        return (
                            <ColumnOption
                                key={field.id}
                                type='button'
                                role='menuitemcheckbox'
                                aria-checked={isSelected}
                                data-testid='column-option'
                                data-selected={isSelected ? 'true' : 'false'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleColumnToggle(sid);
                                }}
                            >
                                {field.name}
                            </ColumnOption>
                        );
                    })}
                </DropdownPanel>
            )}
        </ConfigWrapper>
    );
};

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const AttributeRow = styled.div`
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    gap: 6px;
`;

const AttributeCell = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
`;

const FieldName = styled.span`
    font-weight: 600;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &::after {
        content: ':';
    }
`;

const FieldValue = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ConfigWrapper = styled.div`
    position: relative;
    display: inline-block;
`;

const ConfigureButton = styled.button`
    font-size: 11px;
    color: var(--button-bg);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
`;

const DropdownPanel = styled.div`
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    box-shadow: var(--elevation-2);
    min-width: 160px;
    padding: 4px 0;
`;

const ColumnOption = styled.button`
    padding: 6px 12px;
    font-size: 13px;
    color: var(--center-channel-color);
    background: none;
    border: none;
    width: 100%;
    text-align: left;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &[data-selected='false'] {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;
