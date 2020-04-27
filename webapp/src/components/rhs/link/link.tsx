// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {isMobile} from 'src/utils/utils';

// @ts-ignore
const WebappUtils = window.WebappUtils;

interface Props {
    text: string;
    to?: string;
    actions: {
        toggleRHS: () => void;
    };
}

export default class Link extends React.PureComponent<Props> {
    private handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        if (this.props.to) {
            WebappUtils.browserHistory.push(this.props.to);
            if (isMobile()) {
                this.props.actions.toggleRHS();
            }
        }
    };

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
