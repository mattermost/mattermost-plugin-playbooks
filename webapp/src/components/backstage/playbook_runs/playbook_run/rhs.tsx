import React, {useState} from 'react';

import styled from 'styled-components';

export type RHSSection =
'run-info' |
'run-timeline' |
'run-participants' |
'run-status-updates';

interface Props {

    // playbookRun: PlaybookRun;
    isOpen: boolean;
    onClose: () => void;
    section: RHSSection;
}

const RightHandSidebar = (props: Props) => {

    if (!props.isOpen) {
        return null;
    }
    const sidebarRight = React.useRef(null);

    let title = null;
    let content = null;
    switch (props.section) {
    case 'run-info':
        content = 'run-info';
        title = 'Run info';
        break;
    case 'run-timeline':
        content = 'run-timeline';
        title = 'Timeline';
        break;
    case 'run-participants':
        content = 'run-participants';
        title = 'Participants';
        break;
    case 'run-status-updates':
        content = 'run-status-updates';
        title = 'All status updates';
        break;
    }

    return (
        <Container
            id='playbooks-sidebar-right'
            role='complementary'
            ref={sidebarRight}
            isOpen={props.isOpen}
        >
            <Header>
                <HeaderTitle>{title}</HeaderTitle>
                <HeaderIcon>
                    <i className="icon icon-close" onClick={props.onClose}/>
                </HeaderIcon>
            </Header>
            <Body>{'RHS '}{content}</Body>
        </Container>);
};

export default RightHandSidebar;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    width: 400px;
    height: 100%;
    z-index: 11;
    width: 400px;
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
    color: --center-channel-color-rgb;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: columnn;
`;