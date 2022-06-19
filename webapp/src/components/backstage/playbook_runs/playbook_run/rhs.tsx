// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';

import {renderThumbVertical, renderTrackHorizontal, renderView} from '../../../rhs/rhs_shared';

export enum RHSContent {
    RunInfo = 'run-info',
    RunTimeline = 'run-timeline',
    RunStatusUpdates = 'run-status-updates',
    RunParticipants = 'run-participants',
}

interface Props {

    // playbookRun: PlaybookRun;
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    subtitle?: ReactNode;
}

const RightHandSidebar = ({isOpen, onClose, title, children, subtitle}: Props) => {
    const sidebarRef = React.useRef(null);

    if (!isOpen) {
        return null;
    }

    return (
        <Container
            id='playbooks-sidebar-right'
            role='complementary'
            ref={sidebarRef}
            isOpen={isOpen}
        >
            <Header>
                <HeaderTitle>{title}</HeaderTitle>
                {subtitle && <HeaderSubtitle>{subtitle}</HeaderSubtitle>}
                <HeaderIcon>
                    <i
                        className='icon icon-close'
                        onClick={onClose}
                    />
                </HeaderIcon>
            </Header>
            <Body>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    renderTrackHorizontal={renderTrackHorizontal}
                    style={{position: 'relative'}}
                >
                    {children}
                </Scrollbars>
            </Body>
        </Container>);
};

export default RightHandSidebar;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    position: fixed;
    width: 500px;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    right: 0;
    z-index: 2;
    background-color: var(--center-channel-bg);
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    height: 56px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;
const HeaderIcon = styled.div`
    display: flex;
    align-self: center;
    cursor: pointer;
    flex: 1;
    justify-content: flex-end;
    margin-right: 20px;
`;

const HeaderTitle = styled.div`
    margin: auto 0 auto 20px;
    line-height: 32px;
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
    white-space: nowrap;
`;

const HeaderSubtitle = styled.div`
    overflow: hidden;
    height: 2.4rem;
    padding: 0 8px;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    margin: 0 0 0 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 2.4rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    align-self: center;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;
