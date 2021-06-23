// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {PlaybookRun, playbookRunCurrentStatus} from 'src/types/playbook_run';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';
import {pluginId} from 'src/manifest';
import {currentPlaybookRun} from 'src/selectors';

const SpacedFooterButton = styled(StyledFooterButton)`
    margin-left: 10px;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const RHSFooter = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector(getCurrentTeam);
    const playbookRun = useSelector(currentPlaybookRun);

    let text = 'Update status';
    if (playbookRunCurrentStatus(props.playbookRun) === 'Archived') {
        text = 'Reopen';
    }

    return (
        <Footer id='playbookRunRHSFooter'>
            <StyledFooterButton
                primary={false}
                onClick={() => navigateToUrl(`/${currentTeam.name}/${pluginId}/runs/${playbookRun?.id}`)}
            >
                {'Overview'}
            </StyledFooterButton>
            <SpacedFooterButton
                primary={true}
                onClick={() => dispatch(updateStatus())}
            >
                {text}
            </SpacedFooterButton>
        </Footer>
    );
};

export default RHSFooter;
