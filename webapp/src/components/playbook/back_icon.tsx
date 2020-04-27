// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const BackIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['button']>): JSX.Element => {
    return (
        <button
            {...props}
        >
            <svg
                width='12px'
                height='20px'
                viewBox='0 0 12 20'
                fill='inherit'
                aria-label={'back'}
                xmlns='http://www.w3.org/2000/svg'
            >
                <path
                    d='M11.4 18.6L2.8 10L11.4 1.4L10 -4.76837e-07L5.96046e-08 10L10 20L11.4 18.6Z'
                    fill='inherit'
                />

            </svg>
        </button>
    );
};

export default BackIcon;
