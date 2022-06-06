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
    section: RHSSection;
}

const RightHandSidebar = (props: Props) => {
    const [isOpened, setIsOpened] = useState(props.isOpen);
    const sidebarRight = React.useRef(null);

    let content = null;
    switch (props.section) {
    case 'run-info':
        content = 'run-info';
        break;
    case 'run-timeline':
        content = 'run-timeline';
        break;
    case 'run-participants':
        content = 'run-participants';
        break;
    case 'run-status-updates':
        content = 'run-status-updates';
        break;
    }

    return (
        <Container
            id='playbooks-sidebar-right'
            role='complementary'
            ref={sidebarRight}
            isOpen={props.isOpen}
        >
            <Header/>
            <Body>{'RHS '}{content}</Body>
        </Container>);
};

export default RightHandSidebar;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    flex-direction: column;
    width: 500px;
    height: 100%;
    background-color: red;
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    height: 56px;
    background-color: blue;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: columnn;
    background-color: yellow;
`;