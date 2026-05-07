// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

export const PrimaryButton = styled(Button).attrs({emphasis: 'primary'})``;

export const TertiaryButton = styled(Button).attrs({emphasis: 'tertiary'})``;

export const SecondaryButton = styled(Button).attrs({emphasis: 'secondary'})``;

export const DestructiveButton = styled(Button).attrs({emphasis: 'primary', variant: 'destructive'})``;

export type UpgradeButtonProps = React.ComponentProps<typeof TertiaryButton>;

export const UpgradeTertiaryButton = (props: UpgradeButtonProps & {className?: string}) => {
    const {children, ...rest} = props;
    return (
        <TertiaryButton {...rest}>
            {children}
            <PositionedKeyVariantCircleIcon/>
        </TertiaryButton>
    );
};

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    position: absolute;
    top: -4px;
    right: -6px;
    color: var(--online-indicator);
`;

export const ButtonIcon = styled.button`

    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    fill: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 1.6rem;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        fill: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        fill: var(--button-bg);
    }
`;
