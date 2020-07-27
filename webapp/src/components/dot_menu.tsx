// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useRef} from 'react';
import styled from 'styled-components';

import DotMenuIcon from 'src/components/assets/icons/dot_menu_icon';
import {useKeyPress, useClickOutsideRef} from 'src/hooks';

const DropdownMenu = styled.div`
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    color: var(--center-channel-color);
    position: 'fixed';
    z-index: 1;
`;

const IconWrapper = styled.div`
    display: inline-flex;
    padding: 10px 5px 10px 0;
`;

interface DotMenuProps {
    children: JSX.Element[] | JSX.Element;
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
        <div
            ref={rootRef}
        >
            <IconWrapper
                onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen();
                }}
            >
                <DotMenuIcon/>
            </IconWrapper>
            <div
                className='dropdown'
                style={{position: 'relative'}}
            >
                {
                    isOpen &&
                    <DropdownMenu
                        className='dropdown-menu'
                    >
                        {props.children}
                    </DropdownMenu>
                }
            </div>
        </div>
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
        color: var(--center-channel-color-72);
    }
}
`;

export const DropdownMenuItem = (props: {text: string, onClick: () => void}) => {
    return (
        <DropdownMenuItemStyled
            href='#'
            onClick={() => {
                props.onClick();
            }}
        >
            {props.text}
        </DropdownMenuItemStyled>
    );
};

export default DotMenu;
