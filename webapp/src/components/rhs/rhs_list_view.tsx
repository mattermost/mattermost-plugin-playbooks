// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled, {css} from 'styled-components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';

import {pluginId} from 'src/manifest';
import RHSWelcomeView from 'src/components/rhs/rhs_welcome_view';
import PlusIcon from 'src/components/assets/icons/plus_icon';
import Profile from 'src/components/profile/profile';
import {
    renderThumbVertical,
    renderTrackHorizontal,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {setRHSState, startIncident} from 'src/actions';
import {navigateToUrl} from 'src/browser_routing';
import {RHSState} from 'src/types/rhs';
import {Incident} from 'src/types/incident';
import Duration from 'src/components/duration';

const StartIncidentHeader = styled.div`
    display: block;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height:47px;
    height: 47px;
    letter-spacing: 0;
    text-align: center;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-24)
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
        box-shadow: inset 0px -1px 0px var(--center-channel-color-24), inset 4px 0px 0px #166DE0;
    `}
`;

const IncidentTitle = styled.div`
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 20px;
    letter-spacing: 0;
    text-align: left;
    margin-bottom: 4px;
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    //padding: 8px 0 16px 0;
    //align-items: center;
    font-size: 12px;
    line-height: 16px;
    margin: 4px 0;
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
    flex: 2;
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

interface Props {
    incidentList: Incident[] | null;
    currentIncidentId?: string;
}

const RHSListView = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const viewIncident = (channelId: string) => {
        dispatch(setRHSState(RHSState.ViewingIncident));
        navigateToUrl(`/${currentTeam.name}/channels/${channelId}`);
    };

    const viewBackstageIncidentList = () => {
        navigateToUrl(`/${currentTeam.name}/${pluginId}/incidents`);
    };

    if (!props.incidentList || props.incidentList.length === 0) {
        return <RHSWelcomeView/>;
    }

    return (
        <Scrollbars
            autoHide={true}
            autoHideTimeout={500}
            autoHideDuration={500}
            renderThumbVertical={renderThumbVertical}
            renderView={renderView}
            renderTrackHorizontal={renderTrackHorizontal}
            style={{position: 'absolute'}}
        >
            <StartIncidentHeader>
                <Link onClick={() => dispatch(startIncident())}>
                    <PlusIcon/>{'Start Incident'}
                </Link>
            </StartIncidentHeader>

            {props.incidentList?.map((incident) => {
                return (
                    <IncidentContainer
                        key={incident.id}
                        active={props.currentIncidentId ? props.currentIncidentId === incident.id : false}
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
                        <Button onClick={() => viewIncident(incident.channel_id)}>
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
    );
};

export default RHSListView;
