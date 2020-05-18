// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import IncidentPostMenuIcon from '../assets/icons/post_menu_icon';

interface Props {
    postId: string;
    isSystemMessage: boolean;
    actions: {
        startIncident: (postId: string) => void;
    };
    theme: Record<string, string>;
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
                        data-testid='incidentPostMenuIcon'
                        className='style--none'
                        role='presentation'
                        onClick={this.handleClick}
                    >
                        <IncidentPostMenuIcon theme={this.props.theme}/>
                        {'Start incident'}
                    </button>
                </li>
            </React.Fragment>
        );
    }
}
