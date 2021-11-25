// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, FC} from 'react';
import styled, {css} from 'styled-components';

const TabRow = styled.div`
    display: flex;
    flex-direction: row;
`;

interface TabItemProps {
    active: boolean;
}

const TabItem = styled.div<TabItemProps>`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    cursor: pointer;
    margin-right: 2px;
    width: 104px;
    opacity: 64%;

    box-shadow: inset 0px -2px 0px rgba(var(--center-channel-color-rgb), 0.16);
    ${(props) => props.active && css`
        box-shadow: inset 0px -2px 0px var(--button-bg);
        color: var(--button-bg);
        opacity: 100%;
    `}
`;

export interface TabsProps {
    children: React.ReactNodeArray;
    currentTab: number;
    setCurrentTab: (newTab: number) => void;
}

export const Tabs = (props: TabsProps) => {
    return (
        <TabRow>
            {props.children.map((child, index) => (
                <TabItem
                    key={index}
                    active={index === props.currentTab}
                    onClick={() => props.setCurrentTab(index)}
                >
                    {child}
                </TabItem>
            ))}
        </TabRow>
    );
};

export interface TabsContentProps {
    children: React.ReactNodeArray;
    currentTab: number;
}

export const TabsContent = (props: TabsContentProps) => {
    return (
        <>
            {props.children[props.currentTab]}
        </>
    );
};
