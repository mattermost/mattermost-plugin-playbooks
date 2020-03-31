// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

// @ts-ignore
const WebappUtils = window.WebappUtils;

interface Props {
    text: string;
    to?: string;
}

export default class Link extends React.PureComponent<Props> {
    private handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        WebappUtils.browserHistory.push(this.props.to);
    }

    public render(): JSX.Element {
        return (
            <a
                className='link'
                onClick={this.handleClick}
            >
                {this.props.text}
            </a>
        );
    }
}
