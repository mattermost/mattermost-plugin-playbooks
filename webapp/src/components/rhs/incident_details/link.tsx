// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    text: string;
    href?: string;
}

export default class Link extends React.PureComponent<Props> {
    public render(): JSX.Element {
        return (
            <a
                className='link'
                href={this.props.href}
            >
                {this.props.text}
            </a>
        );
    }
}
