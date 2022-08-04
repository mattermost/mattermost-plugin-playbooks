import React from 'react';
import styled from 'styled-components';

import PlaybooksSidebar from '../sidebar/playbooks_sidebar';

const LHSContainer = styled.div`
    width: 240px;
    background-color: var(--sidebar-bg);

    display: flex;
    flex-direction: column;
`;

const LHSNavigation = () => {
    return (
        <LHSContainer data-testid='lhs-navigation'>
            <PlaybooksSidebar/>
        </LHSContainer>
    );
};

export default LHSNavigation;
