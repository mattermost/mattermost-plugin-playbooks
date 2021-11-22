// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {addNewTask} from 'src/actions';
import {ChecklistItem, ChecklistItemState} from 'src/types/playbook';
import TextWithTooltipWhenEllipsis from 'src/components/widgets/text_with_tooltip_when_ellipsis';

export interface Props {
    title: string;
    index: number;
    collapsed: boolean;
    setCollapsed: (newState: boolean) => void;
    items: ChecklistItem[];
    children: React.ReactNode;
    disabled: boolean;
    titleHelpText?: React.ReactNode;
}

const CollapsibleChecklist = ({
    title,
    index,
    collapsed,
    setCollapsed,
    items,
    children,
    disabled,
    titleHelpText,
}: Props) => {
    const dispatch = useDispatch();
    const titleRef = useRef(null);
    const [showMenu, setShowMenu] = useState(false);

    const icon = collapsed ? 'icon-chevron-right' : 'icon-chevron-down';
    const [completed, total] = tasksCompleted(items);
    const percentage = total === 0 ? 0 : (completed / total) * 100;

    return (
        <Border>
            <HorizontalBG>
                <Horizontal
                    data-testid={'checklistHeader'}
                    onClick={() => setCollapsed(!collapsed)}
                    onMouseEnter={() => setShowMenu(true)}
                    onMouseLeave={() => setShowMenu(false)}
                >
                    <Icon className={icon}/>
                    <Title ref={titleRef}>
                        <TextWithTooltipWhenEllipsis
                            id={index.toString(10)}
                            text={title}
                            parentRef={titleRef}
                        />
                    </Title>
                    {titleHelpText || (
                        <TitleHelpTextWrapper>
                            <FormattedMessage
                                defaultMessage='{completed, number} / {total, number} done'
                                values={{completed, total}}
                            />
                        </TitleHelpTextWrapper>
                    )}
                    {
                        showMenu && !disabled &&
                        <AddNewTask
                            data-testid={'addNewTask'}
                            onClick={(e) => {
                                e.stopPropagation();
                                dispatch(addNewTask(index));
                            }}
                        >
                            <i className='icon-18 icon-plus'/>
                            <FormattedMessage defaultMessage='Task'/>
                        </AddNewTask>
                    }
                </Horizontal>
                <ProgressBackground>
                    <ProgressLine width={percentage}/>
                </ProgressBackground>
            </HorizontalBG>
            {!collapsed && children}
        </Border>
    );
};

const Border = styled.div`
    margin-bottom: 12px;
    background-color: var(--center-channel-color-04);
`;

const ProgressBackground = styled.div`
    position: relative;

    &:after {
        border-bottom: 2px solid var(--center-channel-color-08);
        content: '';
        display: block;
        width: 100%;
    }
`;

const ProgressLine = styled.div<{ width: number }>`
    position: absolute;
    width: 100%;

    &:after {
        border-bottom: 2px solid var(--online-indicator);
        content: '';
        display: block;
        width: ${(props) => props.width}%;
    }
`;

const HorizontalBG = styled.div`
    background-color: var(--center-channel-bg);
    z-index: 1;
    position: sticky;
    top: 48px; // height of rhs_checklists MainTitle
`;

const Horizontal = styled.div`
    background-color: var(--center-channel-color-04);
    border-radius: 4px 4px 0 0;
    border: 1px solid var(--center-channel-color-08);
    display: flex;
    flex-direction: row;
    align-items: baseline;
    cursor: pointer;
`;

const Icon = styled.i`
    position: relative;
    top: 2px;
    margin: 0 0 0 6px;

    font-size: 18px;
    color: var(--center-channel-color-56);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-64);
    }
`;

const Title = styled.div`
    margin: 0 6px 0 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 44px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--center-channel-color-72);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-80);
    }
`;

export const TitleHelpTextWrapper = styled.div`
    margin-right: 16px;

    font-weight: 600;
    font-size: 12px;
    white-space: nowrap;
    color: var(--center-channel-color-48);

    ${Horizontal}:hover & {
        color: var(--center-channel-color-56);
    }
`;

const AddNewTask = styled.button`
    margin: 0 8px 0 auto;
    padding: 0 8px 0 0;
    border-radius: 4px;
    border: 0;

    font-weight: 600;
    font-size: 14px;
    line-height: 32px;
    white-space: nowrap;
    color: var(--center-channel-color-56);
    background: transparent;

    transition: all 0.15s ease-out;

    &:hover {
        background: var(--center-channel-color-08)
    }

    &:active {
        background: var(--center-channel-color-16);
    }
`;

const tasksCompleted = (items: ChecklistItem[]) => {
    let completed = 0;
    let total = 0;

    for (const item of items) {
        if (item.state !== ChecklistItemState.Skip) {
            total++;
        }
        if (item.state === ChecklistItemState.Closed) {
            completed++;
        }
    }

    return [completed, total];
};

export default CollapsibleChecklist;

