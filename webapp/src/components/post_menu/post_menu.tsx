// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import IncidentPostMenuIcon from './icon';

interface Props {
    postId: string;
    isSystemMessage: boolean;
    actions: {
        startIncident: (postId: string) => void;
    };
}

export default class StartIncidentPostMenu extends React.PureComponent<Props> {
    public handleClick = () => {
        this.props.actions.startIncident(this.props.postId);
    };

    public render() {
        if (this.props.isSystemMessage) {
            return null;
        }

        return (
            <React.Fragment>
                <li
                    className='MenuItem'
                    role='menuitem'
                    onClick={this.handleClick}
                >
                    <button
                        className='style--none'
                        role='presentation'
                        onClick={this.handleClick}
                    >
                        <IncidentPostMenuIcon/>
                        {'Start incident'}
                    </button>
                </li>
            </React.Fragment>
        );
    }
}
