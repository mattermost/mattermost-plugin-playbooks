// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

import Icon from 'src/components/assets/svg';

const Svg = styled(Icon)`
    width: 10px;
    height: 11px;
`;

const PlaybookRunIcon = (props: {className?: string}) => (
    <Svg
        className={props.className}
        viewBox='0 0 10 11'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M2.36328 3.01855L6.33594 5.5498L2.36328 8.08105V3.01855ZM0.886719 0.311523V10.7881L9.11328 5.5498L0.886719 0.311523Z'
            fill='currentColor'
        />
    </Svg>
);

export default PlaybookRunIcon;
