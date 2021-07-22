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
        mask-image: url(#rightHole);
    }

    position: relative;

    div:hover + &&&:not(:last-child) {
        mask-image: url(#bothHoles);
    }


    div:hover + &&&:last-child {
        mask-image: url(#leftHole);
    }
`;

export default RHSParticipant;
