// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const BackIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['button']>): JSX.Element => {
    return (
        <button
            {...props}
        >
            <svg
                width='24px'
                height='24px'
                viewBox='0 0 24 24'
                role='icon'
                aria-label={'back'}
            >
                <path d='M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z'/>
            </svg>
        </button>
    );
};

export default BackIcon;
