// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import styled, {css} from 'styled-components';
import {Redirect, Route, useRouteMatch, NavLink, Switch} from 'react-router-dom';

import {GlobalState} from 'mattermost-redux/types/store';
import {Team} from 'mattermost-redux/types/teams';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {Channel} from 'mattermost-redux/types/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {Incident, Metadata as IncidentMetadata} from 'src/types/incident';
import {Overview} from 'src/components/backstage/incidents/incident_backstage/overview/overview';
import {Retrospective} from 'src/components/backstage/incidents/incident_backstage/retrospective/retrospective';
import {clientFetchPlaybook, fetchIncident, fetchIncidentMetadata} from 'src/client';
import {navigateToTeamPluginUrl, navigateToUrl, teamPluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {
    Badge,
    SecondaryButtonLargerRight,
} from 'src/components/backstage/incidents/shared';
import ExportLink from 'src/components/backstage/incidents/incident_details/export_link';
import {useExperimentalFeaturesEnabled} from 'src/hooks';
import {Playbook} from 'src/types/playbook';
import PlaybookIcon from 'src/components/assets/icons/playbook_icon';

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
`;

const FirstRow = styled.div`
    display: flex;
    align-items: center;
    height: 60px;
    margin: 0 32px;
    padding-top: 24px;
`;

const SecondRow = styled.div`
    display: flex;
    height: 60px;
    margin: 0;
    padding: 10px 0 0 80px;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-16);
`;

const BottomContainer = styled.div`
    flex-grow: 1;
    background: rgba(var(--center-channel-color-rgb), 0.03);
    width: 100%;
`;

const InnerContainer = styled.div`
    padding: 20px;
    padding-top: 40px;
    max-width: 1120px;
    margin: 0 auto;
    height: 100%;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;
`;

const LeftArrow = styled.button`
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 24px;
    cursor: pointer;
    color: var(--center-channel-color-56);

    &:hover {
        background: var(--button-bg-08);
        color: var(--button-bg);
    }
`;

const VerticalBlock = styled.div`
    display: flex;
    flex-direction: column;
    font-weight: 400;
    padding: 0 16px 0 24px;
`;

const Title = styled.div`
    font-size: 20px;
    color: var(--center-channel-color);
`;

const PlaybookDiv = styled.div`
    display: flex;
    flex-direction: row;
    color: var(--center-channel-color-64);
    cursor: pointer;

    &:hover {
        color: var(--button-bg);
    }
`;

const SmallPlaybookIcon = styled(PlaybookIcon)`
    height: 13px;
    width: auto;
    margin-top: 1px;
`;

const SubTitle = styled.div`
    font-size: 11px;
    line-height: 16px;
    margin-left: 4px;
`;

const TabItem = styled(NavLink)`
    && {
        line-height: 32px;
        padding: 10px 20px 0 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: unset;
        color: unset;

        &.active {
            box-shadow: inset 0px -2px 0px var(--button-bg);
            color: var(--button-bg);
        }
    }
`;

interface MatchParams {
    incidentId: string
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const IncidentBackstage = () => {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [incidentMetadata, setIncidentMetadata] = useState<IncidentMetadata | null>(null);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);
    const channel = useSelector<GlobalState, Channel | null>((state) => (incident ? getChannel(state, incident.channel_id) : null));
    const match = useRouteMatch<MatchParams>();
    const experimentalFeaturesEnabled = useExperimentalFeaturesEnabled();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    useEffect(() => {
        const incidentId = match.params.incidentId;

        Promise.all([fetchIncident(incidentId), fetchIncidentMetadata(incidentId)]).then(([incidentResult, incidentMetadataResult]) => {
            setIncident(incidentResult);
            setIncidentMetadata(incidentMetadataResult);
            setFetchingState(FetchingStateType.fetched);
        }).catch(() => {
            setFetchingState(FetchingStateType.notFound);
        });
    }, [match.params.incidentId]);

    useEffect(() => {
        const fetchData = async () => {
            if (incident?.playbook_id) {
                const fetchedPlaybook = await clientFetchPlaybook(incident.playbook_id);
                setPlaybook(fetchedPlaybook);
            }
        };

        fetchData();
    }, [incident?.playbook_id]);

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || incident === null || incidentMetadata === null) {
        return <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.INCIDENTS)}/>;
    }

    const goToChannel = () => {
        navigateToUrl(`/${incidentMetadata.team_name}/channels/${incidentMetadata.channel_name}`);
    };

    let channelIcon = 'icon-mattermost';
    if (channel) {
        channelIcon = channel.type === 'O' ? 'icon-globe' : 'icon-lock-outline';
    }

    const closeIncidentDetails = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/incidents');
    };

    return (
        <OuterContainer>
            <TopContainer>
                <FirstRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={closeIncidentDetails}
                    />
                    <VerticalBlock>
                        <Title data-testid='incident-title'>{incident.name}</Title>
                        <PlaybookDiv onClick={() => navigateToTeamPluginUrl(currentTeam.name, `/playbooks/${playbook?.id}`)}>
                            <SmallPlaybookIcon/>
                            <SubTitle>{playbook?.title}</SubTitle>
                        </PlaybookDiv>
                    </VerticalBlock>
                    <Badge status={incident.current_status}/>
                    <SecondaryButtonLargerRight onClick={goToChannel}>
                        <i className={'icon ' + channelIcon}/>
                        {'Go to channel'}
                    </SecondaryButtonLargerRight>
                    <ExportLink incident={incident}/>
                </FirstRow>
                <SecondRow>
                    <TabItem
                        to={`${match.url}/overview`}
                        activeClassName={'active'}
                    >
                        {'Overview'}
                    </TabItem>
                    {experimentalFeaturesEnabled &&
                    <TabItem
                        to={`${match.url}/retrospective`}
                        activeClassName={'active'}
                    >
                        {'Retrospective'}
                    </TabItem>
                    }
                </SecondRow>
            </TopContainer>
            <BottomContainer>
                <InnerContainer>
                    <Switch>
                        <Route path={`${match.url}/overview`}>
                            <Overview incident={incident}/>
                        </Route>
                        <Route path={`${match.url}/retrospective`}>
                            <Retrospective incident={incident}/>
                        </Route>
                        <Redirect to={`${match.url}/overview`}/>
                    </Switch>
                </InnerContainer>
            </BottomContainer>
        </OuterContainer>
    );
};

export default IncidentBackstage;
