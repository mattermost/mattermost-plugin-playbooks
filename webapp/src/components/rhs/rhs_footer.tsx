// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {Team} from 'mattermost-redux/types/teams';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {PlaybookRun, playbookRunCurrentStatus} from 'src/types/playbook_run';

import {Footer, StyledFooterButton} from 'src/components/rhs/rhs_shared';
import {updateStatus} from 'src/actions';
import {navigateToPluginUrl} from 'src/browser_routing';
import {currentPlaybookRun} from 'src/selectors';

const SpacedFooterButton = styled(StyledFooterButton)`
    margin-left: 10px;
`;

interface Props {
    playbookRun: PlaybookRun;
}

const RHSFooter = (props: Props) => {
    const dispatch = useDispatch();
    const playbookRun = useSelector(currentPlaybookRun);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, props.playbookRun.team_id || playbookRun?.team_id || ''));

    let text = 'Update status';
    if (playbookRunCurrentStatus(props.playbookRun) === 'Archived') {
        text = 'Reopen';
    }

    return (
        <Footer id='playbookRunRHSFooter'>
            <StyledFooterButton
                primary={false}
                onClick={() => navigateToPluginUrl(`/runs/${playbookRun?.id}`)}
            >
                {'Overview'}
            </StyledFooterButton>
            <SpacedFooterButton
                primary={true}
                onClick={() => dispatch(updateStatus(team.id))}
            >
                {text}
            </SpacedFooterButton>
        </Footer>
    );
};

export default RHSFooter;
