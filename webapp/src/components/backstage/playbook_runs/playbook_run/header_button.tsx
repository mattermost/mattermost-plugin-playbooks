// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';

interface HeaderButtonProps {
    tooltipId: string;
    tooltipMessage: string
    className: string;
    onClick: () => void;
    clicked?: boolean;
    size?: number;
    iconSize?: number;
}

const HeaderButton = ({tooltipId, tooltipMessage, className, onClick, clicked, size, iconSize}: HeaderButtonProps) => {
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

const StyledHeaderIcon = styled(HeaderIcon)<{size?: number}>`
    margin-left: 4px;
    width: ${(props) => (`${props.size}px` ?? '28px')};
    height: ${(props) => (`${props.size}px` ?? '28px')};
`;

export default HeaderButton;
