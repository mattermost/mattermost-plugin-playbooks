// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const BackIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['button']>): JSX.Element => {
    return (
        <i {...props} className='icon-arrow-left mr-2'/>
    );
};

export default BackIcon;
