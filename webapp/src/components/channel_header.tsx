// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {useRef} from 'react';
import {useSelector} from 'react-redux';
import {createGlobalStyle} from 'styled-components';

import IncidentIcon, {Ref as PlaybookRunIconRef} from 'src/components/assets/icons/incident_icon';

import {isPlaybookRunRHSOpen, isDisabledOnCurrentTeam, inPlaybookRunChannel} from 'src/selectors';

const DisabledStyle = createGlobalStyle`
    .plugin-icon-hide {
        display: none;
    }
`;

export const ChannelHeaderButton = () => {
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

export const ChannelHeaderText = () => {
    const currentChannelIsPlaybookRun = useSelector(inPlaybookRunChannel);
    if (currentChannelIsPlaybookRun) {
        return 'Toggle Run Details';
    }

    return 'Toggle Playbook List';
};

export const ChannelHeaderTooltip = ChannelHeaderText;
