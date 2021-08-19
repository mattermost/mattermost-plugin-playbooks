// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Redirect, useLocation, useRouteMatch} from 'react-router-dom';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline} from '@mdi/js';

const RightMarginedIcon = styled(Icon)`
    margin-right: 0.5rem;
`;

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {DefaultFetchPlaybookRunsParamsTime} from 'src/types/playbook_run';
import {SecondaryButtonLargerRight} from 'src/components/backstage/playbook_runs/shared';
import {clientFetchPlaybook, fetchPlaybookStats, telemetryEventForPlaybook} from 'src/client';
import {navigateToUrl, navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {ErrorPageTypes} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import PlaybookRunList
    from 'src/components/backstage/playbooks/playbook_run_list/playbook_run_list';
import {EmptyPlaybookStats} from 'src/types/stats';
import StatsView from 'src/components/backstage/playbooks/stats_view';
import {startPlaybookRunById} from 'src/actions';
import {PrimaryButton} from 'src/components/assets/buttons';
import ClipboardsPlay from 'src/components/assets/icons/clipboards_play';
import {useForceDocumentTitle} from 'src/hooks';

interface MatchParams {
    playbookId: string
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const PlaybookBackstage = () => {
    const dispatch = useDispatch();
    const match = useRouteMatch<MatchParams>();
    const location = useLocation();
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | null>(null);
    const [fetchParamsTime, setFetchParamsTime] = useState(DefaultFetchPlaybookRunsParamsTime);
    const [filterPill, setFilterPill] = useState<JSX.Element | null>(null);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const [stats, setStats] = useState(EmptyPlaybookStats);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    useEffect(() => {
        const fetchData = async () => {
            const playbookId = match.params.playbookId;
            if (playbookId) {
                try {
                    const fetchedPlaybook = await clientFetchPlaybook(playbookId);
                    setPlaybook(fetchedPlaybook!);
                    setFetchingState(FetchingStateType.fetched);
                } catch {
                    setFetchingState(FetchingStateType.notFound);
                }
            }
        };

        const fetchStats = async () => {
            const playbookId = match.params.playbookId;
            if (playbookId) {
                try {
                    const ret = await fetchPlaybookStats(playbookId);
                    setStats(ret);
                } catch {
                    // Ignore any errors here. If it fails, it's most likely also failed to fetch
                    // the playbook above.
                }
            }
        };

        fetchData();
        fetchStats();
    }, [match.params.playbookId]);

    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || playbook === null) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    const goToPlaybooks = () => {
        navigateToPluginUrl('/playbooks');
    };

    const goToEdit = () => {
        navigateToUrl(location.pathname + '/edit');
    };

    const runPlaybook = () => {
        navigateToUrl(`/${team.name || ''}`);

        if (playbook?.id) {
            telemetryEventForPlaybook(playbook.id, 'playbook_dashboard_run_clicked');
            dispatch(startPlaybookRunById(team.id, playbook.id));
        }
    };

    let subTitle;
    let accessIconClass;
    if (playbook.member_ids.length === 1) {
        subTitle = 'Only you can access this playbook';
        accessIconClass = 'icon-lock-outline';
    } else if (playbook.member_ids.length > 1) {
        subTitle = `${playbook.member_ids.length} people can access this playbook`;
        accessIconClass = 'icon-lock-outline';
    } else if (team) {
        accessIconClass = 'icon-globe';
        subTitle = `Everyone in ${team.name} can access this playbook`;
    } else {
        accessIconClass = 'icon-globe';
        subTitle = 'Everyone in this team can access this playbook';
    }

    const RunButton = () => {
      if (playbook?.delete_at != 0) {
        return null;
      }
      return (
          <PrimaryButtonLarger onClick={runPlaybook}>
              <RightMarginedIcon path={mdiClipboardPlayOutline} size={1.25} />
              {"Run"}
          </PrimaryButtonLarger>
      );
    }

    return (
        <OuterContainer>
            <TopContainer>
                <TitleRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={goToPlaybooks}
                    />
                    <VerticalBlock>
                        <Title>{playbook.title}</Title>
                        <HorizontalBlock data-testid='playbookPermissionsDescription'>
                            <i className={'icon ' + accessIconClass}/>
                            <SubTitle>{subTitle}</SubTitle>
                        </HorizontalBlock>
                    </VerticalBlock>
                    <SecondaryButtonLargerRight onClick={goToEdit}>
                        <i className={'icon icon-pencil-outline'}/>
                        {'Edit'}
                    </SecondaryButtonLargerRight>
                    <RunButton/>
                </TitleRow>
            </TopContainer>
            <BottomContainer>
                <BottomInnerContainer>
                    <StatsView
                        stats={stats}
                        fetchParamsTime={fetchParamsTime}
                        setFetchParamsTime={setFetchParamsTime}
                        setFilterPill={setFilterPill}
                    />
                    <PlaybookRunList
                        playbook={playbook}
                        fetchParamsTime={fetchParamsTime}
                        filterPill={filterPill}
                    />
                </BottomInnerContainer>
            </BottomContainer>
        </OuterContainer>
    );
};

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

const VerticalBlock = styled.div`
    display: flex;
    flex-direction: column;
    font-weight: 400;
    padding: 0 16px 0 24px;
`;

const HorizontalBlock = styled.div`
    display: flex;
    flex-direction: row;
    color: var(--center-channel-color-64);

    > i {
        font-size: 12px;
        margin-left: -3px;
    }
`;

const Title = styled.div`
    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
`;

const SubTitle = styled.div`
    font-size: 11px;
    line-height: 16px;
`;

const ClipboardsPlaySmall = styled(ClipboardsPlay)`
    height: 18px;
    width: auto;
    margin-right: 7px;
    color: var(--button-color);
`;

const PrimaryButtonLarger = styled(PrimaryButton)`
    padding: 0 16px;
    height: 36px;
    margin-left: 12px;
`;

const BottomContainer = styled.div`
    flex-grow: 1;
    background: var(--center-channel-bg);
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

export default PlaybookBackstage;
