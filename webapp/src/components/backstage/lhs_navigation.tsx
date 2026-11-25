// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import PlaybooksSidebar from 'src/components/sidebar/playbooks_sidebar';

const LHSContainer = styled.div`
    display: flex;
    width: 240px;
    flex-direction: column;
    background-color: var(--sidebar-bg);
`;

const LHSNavigation = () => {
    return (
        <LHSContainer data-testid='lhs-navigation'>
            <PlaybooksSidebar/>
        </LHSContainer>
    );
};

const lhsRefreshListeners = new Set<() => void>();

export function subscribeLHSRefresh(listener: () => void): () => void {
    lhsRefreshListeners.add(listener);
    return () => {
        lhsRefreshListeners.delete(listener);
    };
}

export const useLHSRefresh = () => {
    return () => {
        lhsRefreshListeners.forEach((listener) => listener());
    };
};

export default LHSNavigation;
