import React from 'react';
import styled from 'styled-components';

import {PlaybookLhsDocument} from 'src/graphql/generated_types';
import {getPlaybooksGraphQLClient} from 'src/graphql_client';

import PlaybooksSidebar from '../sidebar/playbooks_sidebar';

const LHSContainer = styled.div`
    width: 240px;
    background-color: var(--sidebar-bg);

    display: flex;
    flex-direction: column;
`;

const LHSNavigation = () => {
    return (
        <LHSContainer>
            <PlaybooksSidebar/>
        </LHSContainer>
    );
};

export const refreshLHS = () => {
    getPlaybooksGraphQLClient().refetchQueries({
        include: [PlaybookLhsDocument],
    });
};

export default LHSNavigation;
