// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import StatusBadge from 'src/components/backstage/incidents/status_badge';

export const Container = styled.div`
    display: flex;
    //border: 1px solid blue;
`;

export const Left = styled.div`
    flex: 2;
    //border: 1px solid green;
`;

export const Right = styled.div`
    flex: 1;
    margin-left: 20px;
    //border: 1px solid green;
`;

export const TabPageContainer = styled.div<{first?: boolean}>`
    font-size: 12px;
    font-weight: normal;
    margin-top: ${(props) => (props.first ? 0 : '20px')};
`;

export const Title = styled.div`
    font-size: 14px;
    font-weight: 600;
`;

export const Content = styled.div`
    background: white;
    margin: 8px 0 0 0;
    border: 1px solid grey;
    padding: 0 8px 4px;
`;

export const Heading = styled.div`
    margin: 10px 0 0 0;
    font-weight: 600;
`;

export const Body = styled.p`
    margin: 8px;
`;

export const SecondaryButton = styled(TertiaryButton)`
    background: white;
    border: 1px solid var(--button-bg);
    padding: 0 14px;
    height: 26px;
    font-size: 12px;
    margin-left: 20px;
`;

export const SecondaryButtonRight = styled(SecondaryButton)`
    margin-left: auto;
`;

export const SecondaryButtonLarger = styled(SecondaryButton)`
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

export const SpacedSmallBadge = styled(Badge)<{space?: number}>`
    line-height: 18px;
    margin-left: ${(props) => (props.space ? props.space : 10)}px;
`;

