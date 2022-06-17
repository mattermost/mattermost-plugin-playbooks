import React from 'react';
import styled from 'styled-components';

import {GroupItem} from './sidebar';
import ItemComponent from './item';

interface GroupProps {
    display_name: string;
    isCollapsed: boolean;
    items: GroupItem[];
    onClick: () => void;
}

const Group = (props: GroupProps) => {
    return (
        <GroupContainer>
            <Header>
                <HeaderButton
                    aria-label={props.display_name}
                    onClick={props.onClick}
                >
                    <i className='icon icon-chevron-down'/>
                    <HeaderName>
                        {props.display_name}
                    </HeaderName>
                </HeaderButton>
            </Header>
            <Body role='list'>
                {props.items.map((item) => {
                    return (
                        <ItemComponent
                            key={item.display_name}
                            areaLabel={item.areaLabel}
                            className={item.className}
                            display_name={item.display_name}
                            icon={item.icon}
                            isCollapsed={props.isCollapsed}
                            itemMenu={item.itemMenu}
                            link={item.link}
                        />
                    );
                })}
            </Body>
        </GroupContainer>
    );
};

export default Group;

const GroupContainer = styled.div`
    box-sizing: border-box;
    color: var(--center-channel-color-rgb);
`;

const Header = styled.div`
    z-index: 1;
    top: 0;
    display: flex;
    height: 32px;
    align-items: center;
    border: none;
    background-color: var(--sidebar-bg);
    box-shadow: 0 0 0 0 rgb(0 0 0 / 33%);
    color: rgba(var(--sidebar-text-rgb), 0.6);
    font-family: "Open Sans", sans-serif;
    text-align: left;
    text-overflow: ellipsis;
    text-transform: uppercase;
    transition: box-shadow 0.25s ease-in-out;
`;

const HeaderButton = styled.button`
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    padding: 0;
    border: none;
    background-color: transparent;
    box-shadow: 0 0 0 0 rgb(0 0 0 / 33%);
    color: rgba(var(--sidebar-text-rgb), 0.6);
    text-align: left;
    text-transform: uppercase;
    transition: box-shadow 0.25s ease-in-out;
    white-space: nowrap;
    cursor: pointer;

    :hover{
        color: var(--sidebar-text);
    }
`;

const Body = styled.ul`
    margin: 0px;
    padding: 0px;
    min-height: 2px;
    margin-bottom: 14px;
`;

const HeaderName = styled.div`
    padding-left: 0;
    overflow: hidden;
    width: 100%;
    flex: 0 1 auto;
    text-overflow: ellipsis;
`;
