// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';

import {PrimaryButton, TertiaryButton, DestructiveButton} from 'src/components/assets/buttons';

interface ButtonProps {
    collapsed: boolean;
    isDue: boolean;
    isNextUpdateScheduled: boolean;
    onClick: () => void;
}

const RHSPostUpdateButton = (props: ButtonProps) => {
    let ButtonComponent = PostUpdatePrimaryButton;

    if (props.isDue) {
        ButtonComponent = PostUpdateDestructiveButton;
    } else if (!props.isNextUpdateScheduled) {
        ButtonComponent = PostUpdateTertiaryButton;
    }

    return (
        <ButtonComponent
            collapsed={props.collapsed}
            onClick={props.onClick}
        >
            {'Post update'}
        </ButtonComponent>
    );
};

interface CollapsedProps {
    collapsed: boolean;
}

const PostUpdateButtonCommon = css<CollapsedProps>`
    justify-content: center;
    flex: 1;
    ${(props) => props.collapsed && css`
        height: 32px;
        font-size: 12px;
        font-height: 9.5px;
    `}
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

const PostUpdateTertiaryButton = styled(TertiaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

const PostUpdateDestructiveButton = styled(DestructiveButton)<CollapsedProps>`
    ${PostUpdateButtonCommon}
`;

export default RHSPostUpdateButton;
