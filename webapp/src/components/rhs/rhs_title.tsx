// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookRun} from 'src/types/playbook_run';

import LeftChevron from 'src/components/assets/icons/left_chevron';
import ExternalLink from 'src/components/assets/icons/external_link';
import {RHSState} from 'src/types/rhs';
import {setRHSViewingList} from 'src/actions';
import {currentPlaybookRun, currentRHSState} from 'src/selectors';
import {ButtonIcon} from 'src/components/assets/buttons';

import {navigateToUrl} from 'src/browser_routing';

import {pluginId} from 'src/manifest';

import {OVERLAY_DELAY} from 'src/constants';

const RHSTitle = () => {
    const dispatch = useDispatch();
    const playbookRun = useSelector<GlobalState, PlaybookRun | undefined>(currentPlaybookRun);
    const rhsState = useSelector<GlobalState, RHSState>(currentRHSState);

    if (rhsState === RHSState.ViewingPlaybookRun) {
        return (
            <RHSTitleContainer>
                <Button
                    onClick={() => dispatch(setRHSViewingList())}
                    data-testid='back-button'
                >
                    <LeftChevron/>
                </Button>
                <RHSTitleText data-testid='rhs-title'>{'Run details' || 'Runs'}</RHSTitleText>
                {playbookRun && <ExternalLinkButton playbookRunID={playbookRun?.id || ''}/> }
            </RHSTitleContainer>
        );
    }

    return (
        <RHSTitleText>
            {'Runs in progress'}
        </RHSTitleText>
    );
};

const ExternalLinkButton = ({playbookRunID} : {playbookRunID: string}) => {
    const currentTeam = useSelector(getCurrentTeam);

    const tooltip = (
        <Tooltip id={'view-run-overview'}>
            {'View run overview'}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            placement={'top'}
            delay={OVERLAY_DELAY}
            overlay={tooltip}
        >
            <StyledButtonIcon
                onClick={() => navigateToUrl(`/${currentTeam.name}/${pluginId}/runs/${playbookRunID}`)}
            >
                <ExternalLink/>
            </StyledButtonIcon>
        </OverlayTrigger>
    );
};

const RHSTitleContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    overflow: visible;
`;

const RHSTitleText = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
`;

const Button = styled.button`
    display: flex;
    border: none;
    background: none;
    padding: 0px 11px 0 0;
    align-items: center;
`;

const StyledButtonIcon = styled(ButtonIcon)`
    width: 24px;
    height: 24px;
`;

export default RHSTitle;
