// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef} from 'react';
import {useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {useKeyPress, useClickOutsideRef} from 'src/hooks';

export const DotMenuButton = styled.div`
    display: inline-flex;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    width: 3.2rem;
    height: 3.2rem;
    fill: rgba(var(--center-channel-color-rgb), 0.56);
    color: rgba(var(--center-channel-color-rgb), 0.56);
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
    wide?: boolean;
    topPx?: number;
    leftPx?: number;
}

export const DropdownMenu = styled.div<DropdownMenuProps>`
    display: flex;
    flex-direction: column;

    position: absolute;
    ${(props) => (props.top ? 'bottom: 35px;' : 'top: 100%;')};
    ${(props) => (props.left && css`
        left: ${props.leftPx || -197}px;
        top: ${props.topPx || 35}px;
    `)};
    ${(props) => (props.wide && css`
        left: -236px;
    `)};

    width: max-content;
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

    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

    z-index: 1;
`;

interface DotMenuProps {
    children: React.ReactNode;
    icon: JSX.Element;
    top?: boolean;
    left?: boolean;
    topPx?: number;
    leftPx?: number;
    wide?: boolean;
    dotMenuButton?: typeof DotMenuButton;
    dropdownMenu?: typeof DropdownMenu;
    title?: string;
}

const DotMenu = (props: DotMenuProps) => {
    const {formatMessage} = useIntl();
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(true);
    };

    const rootRef = useRef<HTMLDivElement>(null);
    useClickOutsideRef(rootRef, () => {
        setOpen(false);
    });

    useKeyPress('Escape', () => {
        setOpen(false);
    });

    const MenuButton = props.dotMenuButton ?? DotMenuButton;
    const Menu = props.dropdownMenu ?? DropdownMenu;

    return (
        <MenuButton
            title={props.title}
            ref={rootRef}
            onClick={(e) => {
                e.stopPropagation();
                toggleOpen();
            }}
            onKeyDown={(e) => {
                // Handle Enter and Space as clicking on the button
                if (e.keyCode === 13 || e.keyCode === 32) {
                    e.stopPropagation();
                    toggleOpen();
                }
            }}
            tabIndex={0}
            role={'button'}
        >
            {props.icon}
            <DropdownMenuWrapper>
                {
                    isOpen &&
                    <Menu
                        data-testid='dropdownmenu'
                        top={props.top}
                        left={props.left}
                        topPx={props.topPx}
                        leftPx={props.leftPx}
                        wide={props.wide}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                        }}
                    >
                        {props.children}
                    </Menu>
                }
            </DropdownMenuWrapper>
        </MenuButton>
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
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    }
}
`;

export const DropdownMenuItem = (props: { children: React.ReactNode, onClick: () => void, className?: string }) => {
    return (
        <DropdownMenuItemStyled
            href='#'
            onClick={props.onClick}
            className={props.className}
            role={'button'}
        >
            {props.children}
        </DropdownMenuItemStyled>
    );
};

export default DotMenu;
