// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

import StatusBadge from 'src/components/backstage/playbook_runs/status_badge';

import {PrimaryButton, SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';

export const Container = styled.div`
    display: flex;
    height: 100%;
`;

export const Left = styled.div`
    flex: 2;
`;

export const Right = styled.div`
    flex: 1;
    margin-left: 20px;
`;

export const TabPageContainer = styled.div`
    font-size: 12px;
    font-weight: normal;
    margin-bottom: 20px;
`;

export const Title = styled.div`
    color: var(--button-bg);
    font-size: 18px;
    font-weight: 600;
`;

export const Content = styled.div`
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    margin: 8px 0 0 0;
    padding: 0 8px 4px;
    border: 1px solid var(--center-channel-color-08);
    border-radius: 8px;
`;

export const EmptyBody = styled.div`
    margin: 16px 0 24px 0;
    font-size: 14px;
`;

export const SecondaryButtonSmaller = styled(SecondaryButton)`
    padding: 0 20px;
    height: 26px;
    font-size: 12px;
    margin-left: 20px;
`;

export const SecondaryButtonRight = styled(SecondaryButtonSmaller)`
    margin-left: auto;
`;

export const SecondaryButtonLarger = styled(SecondaryButtonSmaller)`
    padding: 0 16px;
    height: 36px;
`;

export const SecondaryButtonLargerRight = styled(SecondaryButtonLarger)`
    margin-left: auto;
`;

export const PrimaryButtonRight = styled(PrimaryButton)`
    height: 26px;
    padding: 0 14px;
    margin-left: auto;
    font-size: 12px;
`;

export const Badge = styled(StatusBadge)`
    display: unset;
    position: unset;
    height: unset;
    white-space: nowrap;
`;
