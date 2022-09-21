// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useState} from 'react';

export const Card = styled.div`
    background: var(--center-channel-bg);
    width: 100%;

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-sizing: border-box;
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.08);
    border-radius: 4px;

    padding: 16px;
    padding-left: 11px;
    padding-right: 20px;

    display: flex;
    flex-direction: column;
`;

interface CardEntryProps {
    iconName: string;
    title: string;
    extraInfo?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    onClick?: () => void;
    enabled: boolean;
}

export const CardEntry = (props: CardEntryProps) => {
    if (!props.enabled) {
        return null;
    }

    return (
        <EntryWrapper
            className={props.className}
            onClick={props.onClick}
        >
            <Header>
                <i className={`icon-${props.iconName} icon-16`}/>
                <Title>{props.title}</Title>
                <ExtraInfo>{props.extraInfo}</ExtraInfo>
            </Header>
            {props.children && (
                <Subentries>{props.children}</Subentries>
            )}
        </EntryWrapper>
    );
};

interface CardSubEntryProps {
    enabled: boolean;
    title: string;
    extraInfo?: React.ReactNode;
    children?: React.ReactNode;
}

export const CardSubEntry = (props: CardSubEntryProps) => {
    const [open, setOpen] = useState(false);

    if (!props.enabled) {
        return null;
    }

    const icon = props.children ? <ChevronIcon open={open}/> : <MinusIcon/>;

    const toggleOpen = () => setOpen(!open);

    return (
        <CardSubEntryWrapper
            onClick={toggleOpen}
            withChildren={Boolean(props.children)}
        >
            <Header>
                {icon}
                <Title>{props.title}</Title>
                <ExtraInfo>{props.extraInfo}</ExtraInfo>
            </Header>
            {open && props.children && (
                <CardSubEntryContent>{props.children}</CardSubEntryContent>
            )}
        </CardSubEntryWrapper>
    );
};

const EntryWrapper = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 4px;

    :not(:last-child) {
        margin-bottom: 20px;
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 28px;

    i {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const Title = styled.div`
    margin-left: 5px;
    margin-right: 8px;
`;

const ExtraInfo = styled.div`
    display: flex;
    flex-direction: row;
`;

const Subentries = styled.div`
    display: flex;
    flex-direction: column;
    margin-left: 22px;
    margin-top: 8px;

    font-size: 14px;
    color: rgba(var(--center-channel-color), 0.72);
`;

const ChevronIcon = ({open}: {open: boolean}) => {
    return (
        <i className={`icon-${open ? 'chevron-down' : 'chevron-right'} icon-16`}/>
    );
};

const MinusIcon = () => {
    return (
        <SubtleIcon className={'icon-minus icon-16'}/>
    );
};

const SubtleIcon = styled.i`
    opacity: 0.48;
`;

const CardSubEntryWrapper = styled(EntryWrapper)<{withChildren: boolean}>`
    color: rgba(var(--center-channel-color-rgb), 0.72);

    ${({withChildren}) => withChildren && css`
        cursor: pointer;
        transition: background-color 0.2s linear 0s;
        :hover {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
        }

    `}

    && {
        :not(:last-child) {
            margin-bottom: 8px;
        }
    }

    font-size: 14px;
    line-height: 20px;
`;

const CardSubEntryContent = styled.div`
    font-size: 13px;
    line-height: 16px;

    p {
        margin-bottom: 0;

        :not(:last-child) {
            margin-bottom: 6px;
        }

        white-space: pre-wrap;
    }

    margin-left: 32px;
    margin-top: 4px;
    margin-bottom: 8px;

    padding: 4px 8px;
    padding-right: 16px;

    border-left: 2px solid rgba(var(--center-channel-color-rgb),0.24);
`;
