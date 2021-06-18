// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

const ClearIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['i']>): JSX.Element => (
    <i className={`icon icon-close-circle ${props.className}`}/>
);

export default styled(ClearIcon)`
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;
