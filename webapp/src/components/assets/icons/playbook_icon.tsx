// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

import Icon from 'src/components/assets/svg';

const Svg = styled(Icon)`
    width: 14px;
    height: 16px;
`;

const PlaybookIcon = (props: {className?: string}) => (
    <Svg
        className={props.className}
        viewBox='0 0 14 16'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            d='M10.744 2.00605V6.50605L9.25 4.99405L7.756 6.50605V2.00605H4.75V13.994H12.256V2.00605H10.744ZM0.25 4.25605V2.74405H1.744V2.00605C1.744 1.58605 1.888 1.23205 2.176 0.944048C2.476 0.644048 2.836 0.494048 3.256 0.494048H12.256C12.64 0.494048 12.982 0.650048 13.282 0.962048C13.594 1.26205 13.75 1.61005 13.75 2.00605V13.994C13.75 14.39 13.594 14.738 13.282 15.038C12.982 15.35 12.64 15.506 12.256 15.506H3.256C2.86 15.506 2.506 15.35 2.194 15.038C1.894 14.738 1.744 14.39 1.744 13.994V13.256H0.25V11.744H1.744V8.75605H0.25V7.24405H1.744V4.25605H0.25ZM1.744 2.74405V4.25605H3.256V2.74405H1.744ZM1.744 13.256H3.256V11.744H1.744V13.256ZM1.744 8.75605H3.256V7.24405H1.744V8.75605Z'
            fill='currentColor'
        />
    </Svg>
);

export default PlaybookIcon;
