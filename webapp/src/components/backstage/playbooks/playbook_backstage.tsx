// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {Redirect, useLocation, useRouteMatch} from 'react-router-dom';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {
    PrimaryButtonRight,
} from 'src/components/backstage/playbook_runs/shared';

import {clientFetchPlaybook, fetchPlaybookStats} from 'src/client';
import {navigateToTeamPluginUrl, navigateToUrl, teamPluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {Playbook} from 'src/types/playbook';
import ClipboardsPlay from 'src/components/assets/icons/clipboards_play';
import ClipboardsCheckmark from 'src/components/assets/icons/clipboards_checkmark';
import Profiles from 'src/components/assets/icons/profiles';
import LineGraph from 'src/components/backstage/playbooks/line_graph';
import PlaybookRunList from 'src/components/backstage/playbooks/playbook_run_list/playbook_run_list';
import BarGraph from 'src/components/backstage/playbooks/bar_graph';
import {EmptyPlaybookStats} from 'src/types/stats';

const OuterContainer = styled.div`
    background: var(center-channel-bg);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
`;

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
    box-shadow: inset 0px -1px 0px var(--center-channel-color-16);
`;

const TitleRow = styled.div`
    display: flex;
    align-items: center;
    margin: 0 32px;
    height: 82px;
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

const Title = styled.div`
    font-size: 20px;
    padding: 0 16px 0 24px;
    color: var(--center-channel-color);
`;

const PrimaryButtonLargerRight = styled(PrimaryButtonRight)`
    padding: 12px 20px;
    height: 40px;
`;

const BottomContainer = styled.div`
    flex-grow: 1;
    background: rgba(var(--center-channel-color-rgb), 0.03);
    width: 100%;
`;

const BottomInnerContainer = styled.div`
    display: flex;
    flex-direction: column;
    padding: 20px;
    max-width: 1120px;
    margin: 0 auto;
    font-family: 'Open Sans', sans-serif;
    font-style: normal;
    font-weight: 600;

    > div + div {
        margin-top: 16px;
    }
`;

const BottomRow = styled.div`
    display: flex;
    flex-direction: row;

    > div + div {
        margin-left: 16px;
    }
`;

const StatCard = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 20px 12px 20px;

    max-height: 180px;
    max-width: 167px;

    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.32);
    border-radius: 4px;
`;

const StatText = styled.div`
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color-72);
    padding-top: 10px;
`;

const StatNum = styled.div`
    font-size: 44px;
    line-height: 56px;
    color: var(--center-channel-color);
`;

const StatNumRow = styled.div`
    display: flex;
    flex-direction: row;
    width: 100%;
`;

const PercentageChangeRectangle = styled.div`
    margin: auto 12px 8px auto;
    display: flex;
    flex-direction: row;
    border-radius: 10px;
    padding-right: 6px;
    background-color: rgba(var(--online-indicator-rgb), 0.08);
    color: var(--online-indicator);
    font-size: 10px;
    line-height: 15px;

    > i {
        font-size: 12px;
    }
`;

const ClipboardsPlayBig = styled(ClipboardsPlay)`
    height: 32px;
    width: auto;
`;

const ProfilesBig = styled(Profiles)`
    height: 32px;
    width: auto;
`;

const ClipboardsCheckmarkBig = styled(ClipboardsCheckmark)`
    height: 32px;
    width: auto;
`;

const GraphBox = styled.div`
    flex-grow: 1;
    max-width: 532px;
    max-height: 180px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.32);
    border-radius: 4px;
`;

interface MatchParams {
    playbookId: string
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const PlaybookBackstage = () => {
    const match = useRouteMatch<MatchParams>();
    const location = useLocation();
    const currentTeam = useSelector(getCurrentTeam);
    const [playbook, setPlaybook] = useState<Playbook | null>(null);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const [stats, setStats] = useState(EmptyPlaybookStats);

    useEffect(() => {
        const fetchData = async () => {
            const playbookId = match.params.playbookId;
            if (playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(playbookId);
                    setPlaybook(fetchedPlaybook);
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };

        const fetchStats = async () => {
            const playbookId = match.params.playbookId;
            if (playbookId) {
                const ret = await fetchPlaybookStats(playbookId);
                setStats(ret);
            }
        };

        fetchData();
        fetchStats();
    }, [match.params.playbookId]);

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || playbook === null) {
        return <Redirect to={teamPluginErrorUrl(currentTeam.name, ErrorPageTypes.PLAYBOOKS)}/>;
    }

    const goToPlaybooks = () => {
        navigateToTeamPluginUrl(currentTeam.name, '/playbooks');
    };

    const goToEdit = () => {
        navigateToUrl(location.pathname + '/edit');
    };

    let percentage: number | string = stats.runs_finished_percentage_change;
    if (stats.runs_finished_percentage_change === 99999999) {
        percentage = '\u221e';
    }
    let changeSymbol = 'icon-arrow-up';
    if (stats.runs_finished_percentage_change < 0) {
        changeSymbol = 'icon-arrow-down';
    }

    return (
        <OuterContainer>
            <TopContainer>
                <TitleRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={goToPlaybooks}
                    />
                    <Title>{playbook.title}</Title>
                    <PrimaryButtonLargerRight onClick={goToEdit}>
                        <i className={'icon icon-pencil-outline'}/>
                        {'Edit Playbook'}
                    </PrimaryButtonLargerRight>
                </TitleRow>
            </TopContainer>
            <BottomContainer>
                <BottomInnerContainer>
                    <BottomRow>
                        <StatCard>
                            <ClipboardsPlayBig/>
                            <StatText>{'Runs currently in progress'}</StatText>
                            <StatNum>{stats.runs_in_progress}</StatNum>
                        </StatCard>
                        <StatCard>
                            <ProfilesBig/>
                            <StatText>{'Participants currently active'}</StatText>
                            <StatNum>{stats.participants_active}</StatNum>
                        </StatCard>
                        <StatCard>
                            <ClipboardsCheckmarkBig/>
                            <StatText>{'Runs finished in the last 30 days'}</StatText>
                            <StatNumRow>
                                <StatNum>{stats.runs_finished_prev_30_days}</StatNum>
                                <PercentageChangeRectangle>
                                    <i className={'icon ' + changeSymbol}/>
                                    {percentage + '%'}
                                </PercentageChangeRectangle>
                            </StatNumRow>
                        </StatCard>
                        <GraphBox>
                            <LineGraph
                                title={'TOTAL RUNS started per week over the last 12 weeks'}
                                labels={stats.runs_started_per_week_labels.reverse()}
                                data={stats.runs_started_per_week.reverse()}
                            />
                        </GraphBox>
                    </BottomRow>
                    <BottomRow>
                        <GraphBox>
                            <BarGraph
                                title={'ACTIVE RUNS per day over the last 14 days'}
                                labels={stats.active_runs_per_day_labels.reverse()}
                                data={stats.active_runs_per_day.reverse()}
                            />
                        </GraphBox>
                        <GraphBox>
                            <BarGraph
                                title={'ACTIVE PARTICIPANTS per day over the last 14 days'}
                                labels={stats.active_participants_per_day_labels.reverse()}
                                data={stats.active_participants_per_day.reverse()}
                                color={'--center-channel-color-40'}
                            />
                        </GraphBox>
                    </BottomRow>
                    <PlaybookRunList playbook={playbook}/>
                </BottomInnerContainer>
            </BottomContainer>
        </OuterContainer>
    );
};

export default PlaybookBackstage;
