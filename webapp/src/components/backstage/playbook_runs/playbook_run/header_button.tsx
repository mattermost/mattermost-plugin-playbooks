// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React from 'react';

import Tooltip from 'src/components/widgets/tooltip';
import {HeaderIcon} from '../playbook_run_backstage/playbook_run_backstage';
import {CompassIcon} from 'src/types/compass';

interface HeaderButtonProps {
    tooltipId: string;
    tooltipMessage: string
    Icon: CompassIcon;
    onClick: () => void;
    clicked?: boolean;
    size?: number;
    iconSize?: number;
    'aria-label'?: string;
}

const HeaderButton = ({tooltipId, tooltipMessage, Icon, onClick, clicked, size, iconSize, 'aria-label': ariaLabel}: HeaderButtonProps) => {
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
                aria-label={ariaLabel}
            >

                <Icon
                    size={iconSize ?? 18}
                    color={'rgb(var(--center-channel-color-rgb), 0.56)'}
                />
            </StyledHeaderIcon>
        </Tooltip>
    );
};

const StyledHeaderIcon = styled(HeaderIcon)<{size?: number}>`
    margin-left: 4px;
    width: ${(props) => (`${props.size}px` ?? '28px')};
    height: ${(props) => (`${props.size}px` ?? '28px')};
`;

export default HeaderButton;
