// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';

import styled from 'styled-components';

const FileIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['i']>): JSX.Element => (
    <i className={`icon icon-file-outline icon-32 ${props.className}`}/>
);

export default styled(FileIcon)`
    color: var(--mention-highlight-link);
`;
