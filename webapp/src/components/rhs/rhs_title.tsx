// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {GlobalState} from 'mattermost-redux/types/store';

import {useIntl} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import ExternalLink from 'src/components/assets/icons/external_link';
import {RHSState} from 'src/types/rhs';
import {setRHSViewingList} from 'src/actions';
import {currentPlaybookRun, currentRHSState} from 'src/selectors';

import {navigateToPluginUrl} from 'src/browser_routing';

import {OVERLAY_DELAY} from 'src/constants';

const RHSTitle = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const playbookRun = useSelector<GlobalState, PlaybookRun | undefined>(currentPlaybookRun);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);

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
                    <RHSTitleText
                        data-testid='rhs-title'
                        role={'button'}
                        clickable={true}
                        tabIndex={0}
                        onClick={() => navigateToPluginUrl(`/runs/${playbookRun?.id}`)}
                        onKeyDown={(e) => {
                            // Handle Enter and Space as clicking on the button
                            if (e.keyCode === 13 || e.keyCode === 32) {
                                navigateToPluginUrl(`/runs/${playbookRun?.id}`);
                            }
                        }}
                    >
                        {formatMessage({defaultMessage: 'Run details'})}
                        <StyledButtonIcon>
                            <ExternalLink/>
                        </StyledButtonIcon>
                    </RHSTitleText>
                </OverlayTrigger>
            </RHSTitleContainer>
        );
    }

    return (
        <RHSTitleText>
            {/* product name; don't translate */}
            {'Playbooks'}
        </RHSTitleText>
    );
};

const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    overflow: visible;
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
            fill: var(--center-channel-color-72);
        }

        &:active,
        &--active,
        &--active:hover {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
            fill: var(--button-bg);
        }
    `}
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

    ${RHSTitleText}:hover & {
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

export default RHSTitle;
