// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {Switch, Route, Redirect, NavLink, useRouteMatch} from 'react-router-dom';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline} from '@mdi/js';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';

import {useIntl} from 'react-intl';

import {navigateToUrl, navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {useForceDocumentTitle, useStats} from 'src/hooks';
import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookPreview from 'src/components/backstage/playbooks/playbook_preview';

import {clientFetchPlaybook, telemetryEventForPlaybook} from 'src/client';
import {ErrorPageTypes} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {PrimaryButton} from 'src/components/assets/buttons';
import ClipboardsPlay from 'src/components/assets/icons/clipboards_play';
import {RegularHeading} from 'src/styles/headings';

interface MatchParams {
    playbookId: string
}

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const Playbook = () => {
    const {formatMessage} = useIntl();
    const match = useRouteMatch<MatchParams>();
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist | null>(null);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const stats = useStats(match.params.playbookId);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    const activeNavItemStyle = {
        color: 'var(--button-bg)',
        boxShadow: 'inset 0px -2px 0px 0px var(--button-bg)',
    };

    const goToPlaybooks = () => {
        navigateToPluginUrl('/playbooks');
    };

    const runPlaybook = () => {
        if (playbook?.id) {
            telemetryEventForPlaybook(playbook.id, 'playbook_dashboard_run_clicked');
            navigateToUrl(`/${team.name || ''}/_playbooks/${playbook?.id || ''}/run`);
        }
    };

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

        fetchData();
    }, [match.params.playbookId]);

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || playbook === null) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    let subTitle;
    let accessIconClass;
    if (playbook.member_ids.length === 1) {
        subTitle = formatMessage({defaultMessage: 'Only you can access this playbook'});
        accessIconClass = 'icon-lock-outline';
    } else if (playbook.member_ids.length > 1) {
        subTitle = formatMessage({defaultMessage: '{members, plural, =0 {No one} =1 {One person} other {# people}} can access this playbook'}, {members: playbook.member_ids.length});
        accessIconClass = 'icon-lock-outline';
    } else if (team) {
        accessIconClass = 'icon-globe';
        subTitle = formatMessage({defaultMessage: 'Everyone in {team} can access this playbook'}, {team: team.display_name});
    } else {
        accessIconClass = 'icon-globe';
        subTitle = formatMessage({defaultMessage: 'Everyone in this team can access this playbook'});
    }

    const enableRunPlaybook = playbook?.delete_at === 0;

    return (
        <>
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
                    <PrimaryButtonLarger
                        onClick={runPlaybook}
                        disabled={!enableRunPlaybook}
                        data-testid='run-playbook'
                    >
                        <RightMarginedIcon
                            path={mdiClipboardPlayOutline}
                            size={1.25}
                        />
                        {formatMessage({defaultMessage: 'Run'})}
                    </PrimaryButtonLarger>
                </TitleRow>
            </TopContainer>
            <Navbar>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/preview`}
                >
                    {formatMessage({defaultMessage: 'Preview'})}
                </NavItem>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/usage`}
                >
                    {formatMessage({defaultMessage: 'Usage'})}
                </NavItem>
            </Navbar>
            <Switch>
                <Route
                    exact={true}
                    path={`${match.path}`}
                >
                    <Redirect to={`${match.url}/preview`}/>
                </Route>
                <Route path={`${match.path}/preview`}>
                    <PlaybookPreview
                        playbook={playbook}
                        runsInProgress={stats.runs_in_progress}
                    />
                </Route>
                <Route path={`${match.path}/usage`}>
                    <PlaybookUsage
                        playbook={playbook}
                        stats={stats}
                    />
                </Route>
            </Switch>
        </>
    );
};

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
    ${RegularHeading}

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
const Navbar = styled.nav`
    background: var(--center-channel-bg);
    height: 55px;
    width: 100%;
    box-shadow: inset 0px -1px 0px 0px rgba(var(--center-channel-color-rgb), 0.16);

    display: flex;
    flex-direction: row;
    padding-left: 80px;
    margin: 0;
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    text-align: center;
    padding: 0 25px;
    font-weight: 600;

    && {
        color: rgba(var(--center-channel-color-rgb), 0.64);

        :hover {
            color: var(--button-bg);
        }

       :hover, :focus {
            text-decoration: none;
        }
    }
`;

const RightMarginedIcon = styled(Icon)`
    margin-right: 0.5rem;
`;

export default Playbook;
