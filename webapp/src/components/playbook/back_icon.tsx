// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const BackIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['button']>): JSX.Element => {
    return (
        <button
            {...props}
        >
            <i className='icon icon-arrow-back-ios'/>
        </button>
    );
};

export default BackIcon;
