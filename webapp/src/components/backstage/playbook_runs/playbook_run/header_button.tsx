// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React from 'react';

import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';

interface HeaderButtonProps {
    tooltipId: string;
    tooltipMessage: string
    className: string;
    onClick: () => void;
    isActive?: boolean;
    clicked?: boolean;
    size?: number;
    iconSize?: number;
}

const HeaderButton = ({tooltipId, tooltipMessage, className, onClick, isActive, clicked, size, iconSize}: HeaderButtonProps) => {
    return (
        <Tooltip
            id={tooltipId}
            placement={'bottom'}
            shouldUpdatePosition={true}
            content={tooltipMessage}
        >
            <StyledHeaderIcon
                onClick={() => onClick()}
                clicked={clicked ?? false}
                isActive={isActive ?? false}
                size={size}
            >

                <Icon
                    className={className}
                    fontSize={iconSize}
                />
            </StyledHeaderIcon>
        </Tooltip>
    );
};

const Icon = styled.i<{fontSize?: number}>`
    font-size: ${(props) => (`${props.fontSize}px` ?? '18px')};
`;

const StyledHeaderIcon = styled(HeaderIcon)<{isActive: boolean; size?: number}>`
    margin-left: 4px;
    width: ${(props) => (`${props.size}px` ?? '28px')};
    height: ${(props) => (`${props.size}px` ?? '28px')};
    ${({isActive: active}) => active && css`
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    `}
`;

export default HeaderButton;
