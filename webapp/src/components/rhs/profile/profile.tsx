// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './profile.scss';

interface Props {
    profileUri: string;
    name: string;
}

export default class Profile extends React.PureComponent<Props> {
    public render(): JSX.Element {
        return (
            <div className='Profile'>
                <img
                    className='image'
                    src={this.props.profileUri}
                />
                <div className='name'>{this.props.name}</div>
            </div>
        );
    }
}
