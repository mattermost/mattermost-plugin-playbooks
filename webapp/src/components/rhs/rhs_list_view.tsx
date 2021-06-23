// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {PlaybookRun} from 'src/types/playbook_run';

import {pluginId} from 'src/manifest';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import PlusIcon from 'src/components/assets/icons/plus_icon';
import {
    renderThumbVertical,
    renderTrackHorizontal,
    renderView, RHSContainer, RHSContent,
} from 'src/components/rhs/rhs_shared';
import {setRHSViewingPlaybookRun, startPlaybookRun} from 'src/actions';
import {navigateToTeamPluginUrl, navigateToUrl} from 'src/browser_routing';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {myActivePlaybookRunsList} from 'src/selectors';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';
import RHSListPlaybookRun from 'src/components/rhs/rhs_list_playbook_run';

const Header = styled.div`
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    justify-items: center;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height:47px;
    height: 47px;
    letter-spacing: 0;
    text-align: center;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-24);
`;

const CenterCell = styled.div`
    grid-column-start: 2;
`;

const RightCell = styled.div`
    display: inline-flex;
    align-items: center;
    margin: 0 17px 0 auto;
`;

const Link = styled.span`
    color: var(--button-bg);
    cursor: pointer;

    >.icon {
        font-size: 14px;
    }
`;

const Footer = styled.div`
    display: block;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height:47px;
    height: 47px;
    text-align: center;
    padding-bottom: 10rem;
`;

const RHSListView = () => {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const currentChannelId = useSelector<GlobalState, string>(getCurrentChannelId);
    const playbookRunList = useSelector<GlobalState, PlaybookRun[]>(myActivePlaybookRunsList);

    const viewPlaybookRun = (channelId: string) => {
        dispatch(setRHSViewingPlaybookRun());
        navigateToUrl(`/${currentTeam.name}/channels/${channelId}`);
    };

    const viewBackstagePlaybookRunList = () => {
        navigateToUrl(`/${currentTeam.name}/${pluginId}/runs`);
    };

    if (playbookRunList.length === 0) {
        return <RHSWelcomeView/>;
    }

    return (
        <RHSContainer>
            <RHSContent>
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    renderTrackHorizontal={renderTrackHorizontal}
                    style={{position: 'absolute'}}
                >
                    <Header>
                        <CenterCell>
                            <Link onClick={() => dispatch(startPlaybookRun())}>
                                <PlusIcon/>{'Run playbook'}
                            </Link>
                        </CenterCell>
                        <RightCell>
                            <ThreeDotMenu
                                onCreatePlaybook={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                                onSeeAllPlaybookRuns={() => navigateToTeamPluginUrl(currentTeam.name, '/runs')}
                            />
                        </RightCell>
                    </Header>

                    {playbookRunList.map((playbookRun) => {
                        return (
                            <RHSListPlaybookRun
                                key={playbookRun.id}
                                playbookRun={playbookRun}
                                active={currentChannelId === playbookRun.channel_id}
                                viewPlaybookRun={viewPlaybookRun}
                            />
                        );
                    })}

                    <Footer>
                        <a onClick={viewBackstagePlaybookRunList}>{'Click here'}</a>
                        {' to see all runs in the team.'}
                    </Footer>
                </Scrollbars>
            </RHSContent>
        </RHSContainer>
    );
};

interface ThreeDotMenuProps {
    onCreatePlaybook: () => void;
    onSeeAllPlaybookRuns: () => void;
}

const ThreeDotMenu = (props: ThreeDotMenuProps) => (
    <DotMenu
        icon={<HamburgerButton/>}
        left={true}
    >
        <DropdownMenuItem
            text='Create playbook'
            onClick={props.onCreatePlaybook}
        />
        <DropdownMenuItem
            text='See all runs'
            onClick={props.onSeeAllPlaybookRuns}
        />
    </DotMenu>
);

export default RHSListView;
