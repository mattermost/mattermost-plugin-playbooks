// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import classNames from 'classnames';

import 'src/components/profile/profile.scss';

interface Props {
    profileUri?: string;
    userId: string;
    name?: JSX.Element | string;
    classNames?: Record<string, boolean>;
    extra?: JSX.Element;
    actions: {
        fetchUser: (id: string) => void;
    };
}

export default function Profile(props: Props) {
    if (!props.name) {
        props.actions.fetchUser(props.userId);
    }

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
