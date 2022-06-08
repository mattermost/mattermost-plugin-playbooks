import React, {ReactNode} from 'react';

import styled from 'styled-components';

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
}

const RightHandSidebar = ({isOpen, onClose, title, children}: Props) => {
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
                <HeaderIcon>
                    <i
                        className='icon icon-close'
                        onClick={onClose}
                    />
                </HeaderIcon>
            </Header>
            <Body>{children}</Body>
        </Container>);
};

export default RightHandSidebar;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    width: 400px;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);

    @media screen and (min-width: 1680px) {
        width: 500px;
    }
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
    margin: auto 20px;
    line-height: 32px;
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;
