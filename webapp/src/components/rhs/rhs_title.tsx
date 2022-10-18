// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import {GlobalState} from '@mattermost/types/store';

import {PlaybookRun} from 'src/types/playbook_run';
import {useRunFollowers, useRunMetadata} from 'src/hooks';
import LeftChevron from 'src/components/assets/icons/left_chevron';
import FollowButton from 'src/components/backstage/follow_button';
import ExternalLink from 'src/components/assets/icons/external_link';
import {RHSState} from 'src/types/rhs';
import {setRHSViewingList} from 'src/actions';
import {currentPlaybookRun, currentRHSState} from 'src/selectors';
import {pluginUrl} from 'src/browser_routing';
import {OVERLAY_DELAY} from 'src/constants';

const RHSTitle = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const playbookRun = useSelector<GlobalState, PlaybookRun | undefined>(currentPlaybookRun);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);
    const [metadata] = useRunMetadata(playbookRun?.id && rhsState === RHSState.ViewingPlaybookRun ? playbookRun.id : '');
    const followState = useRunFollowers(metadata?.followers || []);

    if (rhsState === RHSState.ViewingPlaybookRun) {
        const tooltip = (
            <Tooltip id={'view-run-overview'}>
                {formatMessage({defaultMessage: 'View run overview'})}
            </Tooltip>
        );

        return (
            <RHSTitleContainer>
                <Button
                    onClick={() => dispatch(setRHSViewingList())}
                    data-testid='back-button'
                >
                    <LeftChevron/>
                </Button>

                <OverlayTrigger
                    placement={'top'}
                    delay={OVERLAY_DELAY}
                    overlay={tooltip}
                >
                    <RHSTitleLink
                        data-testid='rhs-title'
                        role={'button'}
                        to={pluginUrl(`/runs/${playbookRun?.id}?from=channel_rhs_title`)}
                    >
                        {formatMessage({defaultMessage: 'Run details'})}
                        <StyledButtonIcon>
                            <ExternalLink/>
                        </StyledButtonIcon>
                    </RHSTitleLink>
                </OverlayTrigger>
                <FollowingWrapper>
                    <FollowButton
                        runID={playbookRun?.id || ''}
                        followState={metadata ? followState : undefined}
                        trigger={'channel_rhs'}
                    />
                </FollowingWrapper>
            </RHSTitleContainer>
        );
    }

    return (
        <RHSTitleText>
            {/* product name; don't translate */}
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            {'Playbooks'}
        </RHSTitleText>
    );
};

const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    overflow: visible;
    flex: 1;
    justify-content: flex-start;
`;

const FollowingWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;

    // override default styles
    .unfollowButton {
        border: 0;
        color: var(--button-bg);
        background: rgba(var(--button-bg-rgb), 0.08);
    }

    .followButton {
        border: 0;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        background: transparent;

        &:hover {
            color: rgba(var(--center-channel-color-rgb), 0.72);
            background: rgba(var(--center-channel-color-rgb), 0.08);
        }
    }
`;

const RHSTitleText = styled.div<{ clickable?: boolean }>`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;

    overflow: hidden;
    text-overflow: ellipsis;

    border-radius: 4px;

    ${(props) => props.clickable && css`
        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            fill: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &:active,
        &--active,
        &--active:hover {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }
    `}
`;

const RHSTitleLink = styled(Link)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;

    &&& {
        color: var(--center-channel-color);
    }

    overflow: hidden;
    text-overflow: ellipsis;

    border-radius: 4px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        text-decoration: none;
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

const Button = styled.button`
    display: flex;
    border: none;
    background: none;
    padding: 0px 11px 0 0;
    align-items: center;
`;

const StyledButtonIcon = styled.i`
    display: flex;
    align-items: center;
    justify-content: center;

    margin-left: 4px;

    width: 18px;
    height: 18px;

    color: rgba(var(--center-channel-color-rgb), 0.48);

    ${RHSTitleText}:hover &,
    ${RHSTitleLink}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export default RHSTitle;
