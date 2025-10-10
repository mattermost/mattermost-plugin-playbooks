// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {useIntl} from 'react-intl';

import {OverlayTrigger, Tooltip} from 'src/externals/react-bootstrap';

import {useRunFollowers, useRunMetadata} from 'src/hooks';
import LeftChevron from 'src/components/assets/icons/left_chevron';
import FollowButton from 'src/components/backstage/follow_button';
import ExternalLink from 'src/components/assets/icons/external_link';
import {pluginUrl} from 'src/browser_routing';
import {OVERLAY_DELAY} from 'src/constants';

import {
    RHSTitleButton,
    RHSTitleContainer,
    RHSTitleLink,
    RHSTitleStyledButtonIcon,
} from './rhs_title_common';

interface Props {
    onBackClick: () => void;
    runID: string;
}

const RHSRunDetailsTitle = (props: Props) => {
    const {formatMessage} = useIntl();

    const [metadata] = useRunMetadata(props.runID);
    const followState = useRunFollowers(metadata?.followers || []);

    const tooltip = (
        <Tooltip id={'view-run-overview'}>
            {formatMessage({defaultMessage: 'View run overview'})}
        </Tooltip>
    );

    return (
        <RHSTitleContainer>
            <RHSTitleButton
                onClick={props.onBackClick}
                data-testid='back-button'
            >
                <LeftChevron/>
            </RHSTitleButton>

            <OverlayTrigger
                placement={'top'}
                delay={OVERLAY_DELAY}
                overlay={tooltip}
            >
                <RHSTitleLink
                    data-testid='rhs-title'
                    role={'button'}
                    to={pluginUrl(`/runs/${props.runID}?from=channel_rhs_title`)}
                >
                    {formatMessage({defaultMessage: 'Run details'})}
                    <RHSTitleStyledButtonIcon>
                        <ExternalLink/>
                    </RHSTitleStyledButtonIcon>
                </RHSTitleLink>
            </OverlayTrigger>
            <FollowingWrapper>
                <FollowButton
                    runID={props.runID}
                    followState={metadata ? followState : undefined}
                />
            </FollowingWrapper>
        </RHSTitleContainer>
    );
};

const FollowingWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;

    /* override default styles */
    .unfollowButton {
        border: 0;
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }

    .followButton {
        border: 0;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }
    }
`;

export default RHSRunDetailsTitle;
