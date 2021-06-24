// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {useRef, FC} from 'react';
import {useSelector} from 'react-redux';

import {createGlobalStyle} from 'styled-components';

import {isPlaybookRunRHSOpen, isDisabledOnCurrentTeam} from 'src/selectors';

import IncidentIcon, {Ref as PlaybookRunIconRef} from './incident_icon';

const DisabledStyle = createGlobalStyle`
    .plugin-icon-hide {
        display: none;
    }
`;

const ChannelHeaderButton = () => {
    const myRef = useRef<PlaybookRunIconRef>(null);
    const isRHSOpen = useSelector(isPlaybookRunRHSOpen);
    const disabled = useSelector(isDisabledOnCurrentTeam);

    // If it has been mounted, we know our parent is always a button.
    const parent = myRef?.current ? myRef?.current?.parentNode as HTMLButtonElement : null;
    if (parent) {
        if (isRHSOpen) {
            parent.classList.add('channel-header__icon--active');
        } else {
            parent.classList.remove('channel-header__icon--active');
        }

        if (disabled) {
            parent.classList.add('plugin-icon-hide');
        } else {
            parent.classList.remove('plugin-icon-hide');
        }
    }

    return (
        <>
            <DisabledStyle/>
            <IncidentIcon
                id='incidentIcon'
                ref={myRef}
            />
        </>
    );
};

export default ChannelHeaderButton;
