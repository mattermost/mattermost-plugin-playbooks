// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import source from './files_overlay.png';

export const FilesOverlayImage = (props: {alt: string; className?: string; }) => (
    <img
        className={props.className}
        alt={props.alt}
        src={source}
    />
);
