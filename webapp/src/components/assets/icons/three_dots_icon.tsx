// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';

const ThreeDotsIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['i']>): JSX.Element => (
    <i
        className={`icon icon-dots-vertical ${props.className}`}
    />
);

export default ThreeDotsIcon;
