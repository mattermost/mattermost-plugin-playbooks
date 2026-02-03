// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {DateTime} from 'luxon';
import {FormattedMessage} from 'react-intl';

import {ChecklistItem} from 'src/types/playbook';

interface Props {
    item: ChecklistItem;
}

/**
 * Read-only display component for a single quicklist item.
 * Shows the item title, optional description, and due date.
 */
const QuicklistItem = ({item}: Props): React.ReactElement => {
    const hasDueDate = item.due_date > 0;

    return (
        <ItemContainer data-testid='quicklist-item'>
            <ItemContent>
                <CheckboxIcon className='icon-checkbox-blank-outline icon-16'/>
                <ItemDetails>
                    <ItemTitle data-testid='quicklist-item-title'>
                        {item.title}
                    </ItemTitle>
                    {item.description && (
                        <ItemDescription data-testid='quicklist-item-description'>
                            {item.description}
                        </ItemDescription>
                    )}
                </ItemDetails>
            </ItemContent>
            {hasDueDate && (
                <DueDateContainer data-testid='quicklist-item-due-date'>
                    <CalendarIcon className='icon-calendar-outline icon-12'/>
                    <DueDateText>
                        <FormattedMessage
                            defaultMessage='Due {date}'
                            values={{date: formatDueDate(item.due_date)}}
                        />
                    </DueDateText>
                </DueDateContainer>
            )}
        </ItemContainer>
    );
};

/**
 * Format a due date timestamp to a human-readable string.
 * Uses the local date format (e.g., "Jan 15").
 */
const formatDueDate = (timestamp: number): string => {
    const date = DateTime.fromMillis(timestamp);
    return date.toLocaleString({month: 'short', day: 'numeric'});
};

const ItemContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    margin-bottom: 8px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const ItemContent = styled.div`
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
`;

const CheckboxIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    flex-shrink: 0;
    margin-top: 2px;
`;

const ItemDetails = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
`;

const ItemTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--center-channel-color);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const ItemDescription = styled.div`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin-top: 4px;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
`;

const DueDateContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: 8px;
    margin-left: 24px;
    gap: 4px;
`;

const CalendarIcon = styled.i`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const DueDateText = styled.span`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

export default QuicklistItem;
