// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState, useEffect} from 'react';
import moment from 'moment';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Redirect, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Spinner from 'src/components/assets/icons/spinner';
import {fetchIncidentWithDetails} from 'src/client';
import {Incident} from 'src/types/incident';
import Profile from 'src/components/profile/profile';
import {OVERLAY_DELAY, ErrorPageTypes} from 'src/constants';
import {navigateToTeamPluginUrl, navigateToUrl, teamPluginErrorUrl} from 'src/browser_routing';
import {BackstageNavbar, BackstageNavbarIcon} from 'src/components/backstage/backstage';

import StatusBadge from '../status_badge';

import ChecklistTimeline from './checklist_timeline';
import ExportLink from './export_link';

interface MatchParams {
    incidentId: string
}

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    height: 100%;
`;

const Container = styled.div`
    margin: 0 160px;
    width: calc(100vw - 320px);
`;

const IncidentTitle = styled.div`
    padding: 15px;
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const CommanderContainer = styled.div`
    display: flex;
    align-items: center;
    widows: 100%;
    margin-right: 15px;

    .label {
        margin-top: 1px;
        font-size: 12px;
        color: var(--center-channel-color-56);
    }

    .profile {
        font-size: 14px;
    }
`;

const NavbarPadding = styled.div`
    flex-grow: 1;
`;

const BackstageIncidentDetailsContainer = styled.div`
    padding-top: 2rem;
    font-family: $font-family;
    color: var(--center-channel-color-90);
    padding: 4rem 0 3.2rem;

    .details-header {
        display: flex;
        font-size: 2.8rem;
        font-style: normal;
        font-weight: normal;
        bottom: 0;
        left: 0;
        height: auto;

        .link-icon {
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--center-channel-color-56);
            font-size: 20px;
            width: 4rem;
            height: 4rem;

            &:hover {
                background: var(--center-channel-color-08);
                color: var(--center-channel-color-72);
            }

            &:active {
                background: var(--button-bg-08);
                color: var(--button-bg);
            }
        }
    }

    .subheader {
        padding: 1.2rem 0px 2.4rem;
        display: flex;
        justify-content: space-between;
        font-weight: 600;

        .summary-tab {
            color: var(--button-bg);
            width: 98px;
            text-align: center;
            padding: 8px;
            box-shadow: inset 0px -2px 0px var(--button-bg);
        }

        .disabled {
            color: var(--center-channel-color-56);
        }

        .export-link {
            display: flex;
            align-items: center;
            color: var(--button-bg);
        }

        .export-icon {
            font-size: 16px;
            padding-right: 8px;
        }
    }

    .statistics-row {
        display: flex;
        flex-wrap: wrap;
    }

    .chart-block {
        padding: 2rem;
        border: 1px solid var(--center-channel-color-08);
        background: var(--center-channel-bg);
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        margin: 2.4rem 0;
        height: 1%;
        overflow: hidden;
        flex: 0 0 26rem;

        .chart-title {
            color: var(--center-channel-color-56);
            font-size: 14px;
            font-weight: 600;
        }

        .chart-label{
            opacity: .72;
        }
    }

    .statistics-row__block {
        padding: 2rem;
        border: 1px solid var(--center-channel-color-08);
        background: var(--center-channel-bg);
        box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        margin: 0 0 0 3.2rem;
        height: 168px;
        flex: 0 0 26rem;

        &:first-child {
            margin: 0;
        }

        .title {
            color: var(--center-channel-color-56);
            font-size: 14px;
            font-weight: 600;
            padding: 0 0 16px;
        }

        .content {
            font-size: 24px;
            padding-top: 17px;
            padding-bottom: 22px;
            text-align: center;
        }

        .block-footer {
            color: var(--center-channel-color-56);
            font-size: 12px;
            padding-bottom: 20px;

            .icon {
                width: 1.2rem;
                height: 1.2rem;
                margin-left: .8rem;
                font-size: 14px;
            }
        }

        .box-icon {
            padding-right: 19px;
        }
    }

    .no-permission-div {
        padding: 15px;
        margin: 45px;
        border: 1px solid var(--center-channel-color-16);
        text-align: center;
        width: 100%;
    }

    .banner {
        color: #155724;
        background-color: #d4edda;
        border-color: #c3e6cb;
        position: fixed;
        top: 0;
        width: calc(100% - 32rem);
        z-index: 8;
        overflow: hidden;
        padding: 0.5rem 2.4rem;
        text-align: center;
    }
`;

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const BackstageIncidentDetails: FC = () => {
    const [incident, setIncident] = useState<Incident>({} as Incident);
    const currentTeam = useSelector<GlobalState, Team>(getCurrentTeam);

    const match = useRouteMatch<MatchParams>();

    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);

    useEffect(() => {
        const fetchIncident = async (incidentId: string) => {
            try {
                setIncident(await fetchIncidentWithDetails(incidentId));
                setFetchingState(FetchingStateType.fetched);
            } catch {
                setFetchingState(FetchingStateType.notFound);
            }
        };

        fetchIncident(match.params.incidentId);
    }, [match.params.incidentId]);

    if (fetchingState === FetchingStateType.loading) {
        return (
            <div className='container-medium text-center'>
                <div className='BackstageIncidentDetails'>
                    <Spinner/>
                </div>
            </div>
        );
    }

    if (fetchingState === FetchingStateType.notFound) {
        return <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.INCIDENTS)}/>;
    }

    const goToChannel = () => {
        navigateToUrl(`/${incident.team_name}/channels/${incident.channel_name}`);
    };

    const closeIncidentDetails = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/incidents');
    };

    return (
        <OuterContainer>
            <BackstageNavbar>
                <BackstageNavbarIcon
                    className='icon-arrow-left back-icon'
                    onClick={closeIncidentDetails}
                />
                <IncidentTitle data-testid='incident-title'>
                    {`Incident ${incident.name}` }
                </IncidentTitle>
                <StatusBadge isActive={incident.is_active}/>
                <NavbarPadding/>
                <CommanderContainer>
                    <span className='label'>{'Commander:'}</span>
                    <Profile
                        userId={incident.commander_user_id}
                        classNames={{ProfileButton: true, profile: true}}
                    />
                </CommanderContainer>
            </BackstageNavbar>
            <Container>
                <BackstageIncidentDetailsContainer>
                    <div className='subheader'>
                        { /*Summary will be a tab once Post Mortem is included */}
                        <div className='summary-tab'>
                            {'Summary'}
                        </div>
                        <ExportLink incident={incident}/>
                    </div>
                    <div className='statistics-row'>
                        <div className='statistics-row__block'>
                            <div className='title'>
                                {'Duration'}
                            </div>
                            <div className='content'>
                                <i className='icon icon-clock-outline box-icon'/>
                                {duration(incident)}
                            </div>
                            <div className='block-footer text-right'>
                                <span>{timeFrameText(incident)}</span>
                            </div>
                        </div>
                        <OverlayTrigger
                            placement='bottom'
                            delay={OVERLAY_DELAY}
                            overlay={<Tooltip id='goToChannel'>{'Number of users involved in the incident'}</Tooltip>}
                        >
                            <div className='statistics-row__block'>
                                <div className='title'>
                                    {'Members Involved'}
                                </div>
                                <div className='content'>
                                    <i className='icon icon-account-multiple-outline box-icon'/>
                                    {incident.num_members}
                                </div>
                            </div>
                        </OverlayTrigger>
                        <div className='statistics-row__block'>
                            <div className='title'>
                                {'Messages'}
                            </div>
                            <div className='content'>
                                <i className='icon icon-send box-icon'/>
                                {incident.total_posts}
                            </div>
                            <div className='block-footer text-right'>
                                <a
                                    className='link'
                                    onClick={goToChannel}
                                >
                                    {'Jump to Channel'}
                                    <i className='icon icon-arrow-right'/>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className='chart-block'>
                        <ChecklistTimeline
                            incident={incident}
                        />
                    </div>
                </BackstageIncidentDetailsContainer>
            </Container>
        </OuterContainer>
    );
};

const duration = (incident: Incident) => {
    if (!incident.is_active && moment.unix(incident.ended_at).isSameOrBefore('2020-01-01')) {
        // No end datetime available to calculate duration
        return '--';
    }

    const endTime = incident.is_active ? moment() : moment.unix(incident.ended_at);

    const timeSinceCreation = moment.duration(endTime.diff(moment.unix(incident.created_at)));

    if (timeSinceCreation.days()) {
        return `${timeSinceCreation.days()} days ${timeSinceCreation.hours()} h`;
    }

    if (timeSinceCreation.hours()) {
        return `${timeSinceCreation.hours()} h ${timeSinceCreation.minutes()} m`;
    }

    if (timeSinceCreation.minutes()) {
        return `${timeSinceCreation.minutes()} m`;
    }

    return `${timeSinceCreation.seconds()} s`;
};

const timeFrameText = (incident: Incident) => {
    const mom = moment.unix(incident.ended_at);

    let endedText = 'Ongoing';

    if (!incident.is_active) {
        endedText = mom.isSameOrAfter('2020-01-01') ? mom.format('DD MMM h:mmA') : '--';
    }

    const startedText = moment.unix(incident.created_at).format('DD MMM h:mmA');

    return (`${startedText} - ${endedText}`);
};

export default BackstageIncidentDetails;
