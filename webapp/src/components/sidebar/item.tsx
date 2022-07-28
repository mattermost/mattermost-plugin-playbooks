import React from 'react';
import {NavLink} from 'react-router-dom';

import styled, {css} from 'styled-components';

interface ItemProps {
    icon: React.ReactNode;
    itemMenu?: React.ReactNode;
    id: string;
    display_name: string;
    className: string;
    areaLabel: string;
    link: string;
    isCollapsed: boolean;
}

const Item = (props: ItemProps) => {
    return (
        <ItemContainer isCollapsed={props.isCollapsed}>
            <StyledNavLink
                className={props.className}
                id={`sidebarItem_${props.id}`}
                aria-label={props.areaLabel}
                to={props.link}
                tabIndex={props.isCollapsed ? -1 : 0}
            >
                <Icon>
                    {props.icon}
                </Icon>
                <ItemDisplayLabel>
                    {props.display_name}
                </ItemDisplayLabel>
                {props.itemMenu}
            </StyledNavLink>
        </ItemContainer>
    );
};

export const ItemDisplayLabel = styled.span`
    max-width: 100%;
    height: 18px;
    line-height: 18px;
    text-align: justify;
    white-space: nowrap;
    color: rgba(var(--sidebar-text-rgb), 0.72);
    font-size: 14px;
`;

export const Icon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 6px 0 -2px;
    font-size: 18px;
    color: rgba(var(--sidebar-text-rgb), 0.72);
`;

export const ItemContainer = styled.li<{isCollapsed?: boolean}>`
    display: flex;
    overflow: hidden;
    height: 32px;
    align-items: center;
    color: rgba(var(--sidebar-text-rgb), 0.6);
    list-style-type: none;
    opacity: 1;
    transition: height 0.18s ease;
    visibility: visible;

    ${(props) => props.isCollapsed && css`
        height: 0px;
    `};
`;

export const StyledNavLink = styled(NavLink)`
    position: relative;
    display: flex;
    width: 240px;
    height: 32px;
    align-items: center;
    padding: 7px 16px 7px 19px;
    border-top: 0;
    border-bottom: 0;
    margin-right: 0;
    color: rgba(var(--sidebar-text-rgb), 0.72);
    font-size: 14px;
    text-decoration: none;

    :hover,
    :focus {
        text-decoration: none;
    }

    :hover,
    :focus-visible {
        padding-right: 5px;
        background: rgba(var(--sidebar-text-rgb), 0.08);
    }

    &.active {
        background: rgba(var(--sidebar-text-rgb), 0.16);
        ${ItemDisplayLabel},
        ${Icon} {
            color: rgba(var(--sidebar-text-rgb), 1);
        }

        :hover,
        :focus-visible {
            background: rgba(var(--sidebar-text-rgb), 0.24);
        }
        ::before {
            position: absolute;
            top: 0;
            left: -2px;
            width: 4px;
            height: 100%;
            background: var(--sidebar-text-active-border);
            border-radius: 4px;
            content: "";
        }
    }
`;

export default Item;
