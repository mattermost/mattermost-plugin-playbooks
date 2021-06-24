// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './profile_button.scss';
import Profile from 'src/components/profile/profile';

interface Props {
    userId?: string;
    enableEdit: boolean;
    withoutProfilePic?: boolean;
    profileButtonClass?: string;
    onClick: () => void;
}

export default function ProfileButton(props: Props) {
    const downChevron = props.enableEdit ? <i className='icon-chevron-down ml-1 mr-2'/> : <></>;

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
            className={props.profileButtonClass || 'PlaybookRunProfileButton'}
        >
            <Profile
                userId={props.userId || ''}
                classNames={{active: props.enableEdit}}
                extra={downChevron}
                nameFormatter={formatName}
                withoutProfilePic={props.withoutProfilePic}
            />
        </button>
    );
}
