// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const BackIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['button']>): JSX.Element => {
    return (
        <button
            {...props}
        >
            <svg
                width='8px'
                height='12px'
                viewBox='0 0 8 12'
                fill='none'
                aria-label={'back'}
                xmlns='http://www.w3.org/2000/svg'
            >
                <path
                    d='M7.06 10.14L2.92 5.99999L7.06 1.85999L5.8 0.599987L0.4 5.99999L5.8 11.4L7.06 10.14Z'
                    fill='white'
                />
            </svg>
        </button>
    );
};

export default BackIcon;
