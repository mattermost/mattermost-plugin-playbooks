// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {useRef, FC} from 'react';
import {useSelector} from 'react-redux';

import {isIncidentRHSOpen} from 'src/selectors';

import IncidentIcon, {Ref as IncidentIconRef} from './incident_icon';

const ChannelHeaderButton: FC = () => {
    const myRef = useRef<IncidentIconRef>(null);
    const isRHSOpen = useSelector(isIncidentRHSOpen);

    // If it has been mounted, we know our parent is always a button.
    const parent = myRef?.current ? myRef?.current?.parentNode as HTMLButtonElement : null;
    if (parent) {
        if (isRHSOpen) {
            parent.classList.add('channel-header__icon--active');
        } else {
            parent.classList.remove('channel-header__icon--active');
        }
    }

    return (
        <IncidentIcon
            id='incidentIcon'
            ref={myRef}
        />
    );
};

export default ChannelHeaderButton;
