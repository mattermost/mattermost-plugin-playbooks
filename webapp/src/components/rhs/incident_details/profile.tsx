// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

interface Props {
    profileUri: string;
    name: string;
}

export default class Profile extends React.PureComponent<Props> {
    public render(): JSX.Element {
        return (
            <div className='profile-container'>
                <img
                    className='pic'
                    src={this.props.profileUri}
                />
                <div className='name'>{this.props.name}</div>
            </div>
        );
    }
}
