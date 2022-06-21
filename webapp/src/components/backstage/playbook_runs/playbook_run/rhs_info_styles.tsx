// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const Container = styled.div`
    display: flex;
    flex-direction: column;
`;

export const Section = styled.section`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 24px 0;
`;

export const SectionTitle = styled.div`
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;

    color: rgba(var(--center-channel-color-rgb), 0.72);

    margin: 0 24px;
    margin-bottom: 8px;
`;
