// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useRef} from 'react';
import styled, {css} from 'styled-components';

import {useKeyPress, useClickOutsideRef} from 'src/hooks';

const DotMenuButton = styled.div`
    display: inline-flex;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    width: 3.2rem;
    height: 3.2rem;
    fill: var(--center-channel-color-56);
    color: var(--center-channel-color-56);
    cursor: pointer;

    &:hover {
       background: rgba(var(--center-channel-color-rgb), 0.08);
       color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const DropdownMenuWrapper = styled.div`
    position: relative;
`;

interface DropdownMenuProps {
    top?: boolean;
    left?: boolean;
}

const DropdownMenu = styled.div<DropdownMenuProps>`
    display: flex;
    flex-direction: column;

    position: absolute;
    ${(props) => (props.top ? 'bottom: 35px;' : 'top: 100%;')};
    ${(props) => (props.left && css`
        left: -197px;
        top: 35px;
    `)};
    min-width: 160px;
    text-align: left;
    list-style: none;

    padding: 10px 0;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);
    position: 'fixed';

    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

    z-index: 1;
`;

interface DotMenuProps {
    children: JSX.Element[] | JSX.Element;
    icon: JSX.Element;
    top?: boolean;
    left?: boolean;
}

const DotMenu: FC<DotMenuProps> = (props: DotMenuProps) => {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };

    const rootRef = useRef<HTMLDivElement>(null);
    useClickOutsideRef(rootRef, () => {
        setOpen(false);
    });

    useKeyPress('Escape', () => {
        setOpen(false);
    });

    return (
        <DotMenuButton
            ref={rootRef}
            onClick={(e) => {
                e.stopPropagation();
                toggleOpen();
            }}
        >
            {props.icon}
            <DropdownMenuWrapper>
                {
                    isOpen &&
                    <DropdownMenu
                        top={props.top}
                        left={props.left}
                    >
                        {props.children}
                    </DropdownMenu>
                }
            </DropdownMenuWrapper>
        </DotMenuButton>
    );
};

const DropdownMenuItemStyled = styled.a`
 && {
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    color: var(--center-channel-color);
    padding: 10px 20px;
    text-decoration: unset;


    &:hover {
        background: var(--center-channel-color-08);
        color: var(--center-channel-color);
    }
}
`;

export const DropdownMenuItem = (props: { text: string, onClick: () => void }) => {
    return (
        <DropdownMenuItemStyled
            href='#'
            onClick={props.onClick}
        >
            {props.text}
        </DropdownMenuItemStyled>
    );
};

export default DotMenu;
