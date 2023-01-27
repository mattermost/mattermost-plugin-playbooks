// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import {DropdownMenuItem} from 'src/components/dot_menu';

export const Spacer = styled.div`
    flex-grow: 1;
`;

export const IconWrapper = styled.div<{ margin?: string }>`
    display: inline-flex;
    margin-right: ${({margin}) => (margin || '11px')};
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-items: center;
    align-content: center;
`;
