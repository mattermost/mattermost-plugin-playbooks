// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import {mdiClockOutline, mdiCurrencyUsd, mdiPound} from '@mdi/js';
import Icon from '@mdi/react';
import React from 'react';

export const Section = styled.div`
    margin: 32px 0;
`;

export const SectionTitle = styled.div`
    font-weight: 600;
    margin: 0 0 32px 0;
`;

export const SidebarBlock = styled.div`
    margin: 0 0 40px;
`;

export const Setting = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    margin-bottom: 24px;
`;

export const BackstageGroupToggleHeader = styled.div`
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    display: flex;
    flex-direction: row;
    align-items: center;
`;

export const ClockOutline = ({sizePx}: {sizePx: number}) => (
    <Icon
        path={mdiClockOutline}
        size={`${sizePx}px`}
    />
);

export const DollarSign = ({sizePx}: {sizePx: number}) => (
    <Icon
        path={mdiCurrencyUsd}
        size={`${sizePx}px`}
    />
);

export const PoundSign = ({sizePx}: {sizePx: number}) => (
    <Icon
        path={mdiPound}
        size={`${sizePx}px`}
    />
);
