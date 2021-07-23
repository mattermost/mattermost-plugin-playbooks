// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import Profile from 'src/components/profile/profile';

import {OVERLAY_DELAY} from 'src/constants';

import {useFormattedUsernameByID} from 'src/hooks';

const RHSParticipant = (props: UserPicProps) => {
    const name = useFormattedUsernameByID(props.userId);

    const tooltip = (
        <Tooltip id={'username-' + props.userId}>
            {name}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            placement={'bottom'}
            delay={OVERLAY_DELAY}
            overlay={tooltip}
        >
            <UserPic>
                <Profile
                    userId={props.userId}
                    withoutName={true}
                />
            </UserPic>
        </OverlayTrigger>
    );
};

interface UserPicProps {
    userId: string;
}

const leftHoleSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M 3.8043 4.4058 A 14 14 0 1 1 3.8043 23.5942 A 16 16 0 0 0 3.8043 4.4058 Z"/></svg>';
const rightHoleSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M 24.1957 4.4058 A 14 14 0 1 0 24.1957 23.5942 A 16 16 0 0 1 24.1957 4.4058 Z"/></svg>';
const bothHolesSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path d="M 3.8043 4.4058 A 14 14 0 0 1 24.1957 4.4058 A 16 16 0 0 0 24.1957 23.5942 A 14 14 0 0 1 3.8043 23.5942 A 16 16 0 0 0 3.8043 4.4058 Z"/></svg>';

const UserPic = styled.div`
    .IncidentProfile {
        flex-direction: column;

        .name {
            display: none;
        }
    }

    && .image {
        margin: 0;
        width: 28px;
        height: 28px;
    }

    :not(:first-child) {
        margin-left: -5px;
    }

    :not(:last-child):not(:hover) {
        mask-image: url('${rightHoleSvg}');
    }

    position: relative;

    div:hover + &&&:not(:last-child) {
        mask-image: url('${bothHolesSvg}');
    }


    div:hover + &&&:last-child {
        mask-image: url('${leftHoleSvg}');
    }
`;

export default RHSParticipant;
