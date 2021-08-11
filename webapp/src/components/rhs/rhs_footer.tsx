// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {PlaybookRun, playbookRunCurrentStatus} from 'src/types/playbook_run';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {navigateToPluginUrl} from 'src/browser_routing';

const SpacedFooterButton = styled(StyledFooterButton)`
    margin-left: 10px;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const RHSFooter = (props: Props) => {
    const dispatch = useDispatch();

    let text = 'Update status';
    if (playbookRunCurrentStatus(props.playbookRun) === 'Archived') {
        text = 'Reopen';
    }

    return (
        <Footer id='playbookRunRHSFooter'>
            <StyledFooterButton
                primary={false}
                onClick={() => navigateToPluginUrl(`/runs/${props.playbookRun?.id}`)}
            >
                {'Overview'}
            </StyledFooterButton>
            <SpacedFooterButton
                primary={true}
                onClick={() => dispatch(updateStatus(props.playbookRun?.team_id || ''))}
            >
                {text}
            </SpacedFooterButton>
        </Footer>
    );
};

export default RHSFooter;
