// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import 'src/components/profile/profile_selector/profile_button/profile_button.scss';
import Profile from 'src/components/profile';

interface Props {
    userId: string;
    enableEdit: boolean;
    onClick: () => void;
}

export default function ProfileButton(props: Props) {
    const downChevron = props.enableEdit ? <i className='icon-chevron-down ml-2 mr-2'/> : <></>;

    const formatName = (preferredName: string, userName: string) => {
        let name = preferredName;
        if (preferredName === userName) {
            name = '@' + name;
        }
        return <span>{name}</span>;
    };

    return (
        <button
            onClick={props.onClick}
            className={'ProfileButton'}
        >
            <Profile
                userId={props.userId}
                classNames={{active: props.enableEdit}}
                extra={downChevron}
                nameFormatter={formatName}
            />
        </button>
    );
}
