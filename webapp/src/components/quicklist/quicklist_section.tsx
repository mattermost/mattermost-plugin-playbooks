// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import styled from 'styled-components';

import {Checklist} from 'src/types/playbook';

import QuicklistItem from './quicklist_item';

interface Props {
    checklist: Checklist;

    /** Whether the section should start collapsed */
    defaultCollapsed?: boolean;
}

/**
 * Collapsible section component for displaying a group of quicklist items.
 * Each section corresponds to one checklist/section from the AI-generated result.
 */
const QuicklistSection = ({checklist, defaultCollapsed = false}: Props): React.ReactElement => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    const toggleCollapsed = () => setCollapsed(!collapsed);

    const itemCount = checklist.items.length;

    return (
        <SectionContainer data-testid='quicklist-section'>
            <SectionHeader
                onClick={toggleCollapsed}
                data-testid='quicklist-section-header'
            >
                <ChevronIcon
                    className={collapsed ? 'icon-chevron-right icon-16' : 'icon-chevron-down icon-16'}
                    $collapsed={collapsed}
                />
                <SectionTitle data-testid='quicklist-section-title'>
                    {checklist.title}
                </SectionTitle>
                <ItemCount data-testid='quicklist-section-count'>
                    {itemCount}
                </ItemCount>
            </SectionHeader>
            {!collapsed && (
                <SectionContent data-testid='quicklist-section-content'>
                    {checklist.items.map((item, index) => (
                        <QuicklistItem
                            key={item.id || `item-${index}`}
                            item={item}
                        />
                    ))}
                </SectionContent>
            )}
        </SectionContainer>
    );
};

const SectionContainer = styled.div`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    margin-bottom: 12px;
    overflow: hidden;

    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionHeader = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px 16px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    cursor: pointer;
    user-select: none;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const ChevronIcon = styled.i<{$collapsed: boolean}>`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    flex-shrink: 0;
    margin-right: 8px;
    transition: transform 0.15s ease-out;
`;

const SectionTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--center-channel-color);
    flex: 1;
`;

const ItemCount = styled.div`
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    background: rgba(var(--center-channel-color-rgb), 0.08);
    padding: 2px 8px;
    border-radius: 10px;
`;

const SectionContent = styled.div`
    padding: 12px 16px;
`;

export default QuicklistSection;
