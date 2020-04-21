// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './profile_button.scss';
import Profile from 'src/components/rhs/profile';

interface Props {
    userId: string;
    enableEdit: boolean;
    onClick: () => void;
}

export default function ProfileButton(props: Props) {
    const downChevron = props.enableEdit ? <i className='icon-chevron-down ml-2 mr-3'/> : <></>;
    return (
        <button
            onClick={props.onClick}
            className={'profile-button'}
        >
            <Profile
                userId={props.userId}
                classNames={{active: props.enableEdit}}
                extra={downChevron}
            />
        </button>
    );
}
