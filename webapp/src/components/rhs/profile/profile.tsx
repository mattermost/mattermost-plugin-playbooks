// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import classNames from 'classnames';

import './profile.scss';

interface Props {
    profileUri: string;
    name: string;
    classNames?: Record<string, boolean>;
    extra?: JSX.Element;
}

export default function Profile(props: Props) {
    return (
        <div className={classNames('Profile', props.classNames)}>
            <img
                className='image'
                src={props.profileUri}
            />
            <div className='name'>{props.name}</div>
            {props.extra}
        </div>
    );
}
