// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {useRef, FC} from 'react';
import {useSelector} from 'react-redux';

import {workflowsRHSOpen} from 'src/selectors';

const IncidentIcon: FC = () => {
    const myRef = useRef(null);
    const isRHSOpen = useSelector(workflowsRHSOpen);

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
        <i
            id='incidentIcon'
            ref={myRef}
            className={'icon fa fa-exclamation'}
        />
    );
};

export default IncidentIcon;
