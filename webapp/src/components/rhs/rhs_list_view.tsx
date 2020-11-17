// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled, {css} from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {pluginId} from 'src/manifest';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import PlusIcon from 'src/components/assets/icons/plus_icon';
import Profile from 'src/components/profile/profile';
import {
    renderThumbVertical,
    renderTrackHorizontal,
    renderView, RHSContainer, RHSContent,
} from 'src/components/rhs/rhs_shared';
import {setRHSViewingIncident, startIncident} from 'src/actions';
import {navigateToTeamPluginUrl, navigateToUrl} from 'src/browser_routing';
import {Incident} from 'src/types/incident';
import Duration from 'src/components/duration';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {myActiveIncidentsList} from 'src/selectors';
import {HamburgerButton} from 'src/components/assets/icons/three_dots_icon';

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

interface IncidentContainerProps {
    active: boolean;
}

const IncidentContainer = styled.div<IncidentContainerProps>`
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-24);

    ${(props) => props.active && css`
        box-shadow: inset 0px -1px 0px var(--center-channel-color-24), inset 4px 0px 0px var(--button-bg);
    `}
`;

const IncidentTitle = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
    margin-bottom: 6px;
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    font-size: 12px;
    line-height: 20px;
    margin: 1px 0;
`;

const Col1 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    font-weight: 600;
`;

const Col2 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 3;
    font-weight: 400;
`;

const SmallerProfile = styled(Profile)`
    >.image {
        width: 20px;
        height: 20px;
    }
`;

const Button = styled.button`
    display: block;
    border: 1px solid var(--button-bg);
    border-radius: 4px;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    line-height: 9.5px;
    color: var(--button-bg);
    text-align: center;
    padding: 10px 0;
    margin-top: 10px;
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
    const incidentList = useSelector<GlobalState, Incident[]>(myActiveIncidentsList);

    const viewIncident = (channelId: string) => {
        dispatch(setRHSViewingIncident());
        navigateToUrl(`/${currentTeam.name}/channels/${channelId}`);
    };

    const viewBackstageIncidentList = () => {
        navigateToUrl(`/${currentTeam.name}/${pluginId}/incidents`);
    };

    if (incidentList.length === 0) {
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
                            <Link onClick={() => dispatch(startIncident())}>
                                <PlusIcon/>{'Start Incident'}
                            </Link>
                        </CenterCell>
                        <RightCell>
                            <ThreeDotMenu
                                onCreatePlaybook={() => navigateToTeamPluginUrl(currentTeam.name, '/playbooks')}
                                onSeeAllIncidents={() => navigateToTeamPluginUrl(currentTeam.name, '/incidents')}
                            />
                        </RightCell>
                    </Header>

                    {incidentList.map((incident) => {
                        return (
                            <IncidentContainer
                                key={incident.id}
                                active={currentChannelId === incident.channel_id}
                            >
                                <IncidentTitle>{incident.name}</IncidentTitle>
                                <Row>
                                    <Col1>{'Stage:'}</Col1>
                                    <Col2>{incident.active_stage_title}</Col2>
                                </Row>
                                <Row>
                                    <Col1>{'Duration:'}</Col1>
                                    <Col2>
                                        <Duration
                                            created_at={incident.create_at}
                                            ended_at={incident.end_at}
                                        />
                                    </Col2>
                                </Row>
                                <Row>
                                    <Col1>{'Commander:'}</Col1>
                                    <Col2>
                                        <SmallerProfile userId={incident.commander_user_id}/>
                                    </Col2>
                                </Row>
                                <Button
                                    onClick={() => viewIncident(incident.channel_id)}
                                    data-testid='go-to-channel'
                                >
                                    {'Go to Incident Channel'}
                                </Button>
                            </IncidentContainer>
                        );
                    })}

                    <Footer>
                        {'Looking for closed incidents? '}
                        <a onClick={viewBackstageIncidentList}>{'Click here'}</a>
                        {' to see all incidents.'}
                    </Footer>
                </Scrollbars>
            </RHSContent>
        </RHSContainer>
    );
};

interface ThreeDotMenuProps {
    onCreatePlaybook: () => void;
    onSeeAllIncidents: () => void;
}

const ThreeDotMenu = (props: ThreeDotMenuProps) => (
    <DotMenu
        icon={<HamburgerButton/>}
        left={true}
    >
        <DropdownMenuItem
            text='Create Playbook'
            onClick={props.onCreatePlaybook}
        />
        <DropdownMenuItem
            text='See all Incidents'
            onClick={props.onSeeAllIncidents}
        />
    </DotMenu>
);

export default RHSListView;
