// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {Switch, Route, Redirect, NavLink, useRouteMatch} from 'react-router-dom';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useIntl} from 'react-intl';

import {pluginErrorUrl} from 'src/browser_routing';
import {
    useForceDocumentTitle,
    useStats,
    usePlaybook,
} from 'src/hooks';

import {
    clientFetchPlaybookFollowers,
    telemetryEventForPlaybook,
} from 'src/client';
import {ErrorPageTypes} from 'src/constants';

import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookKeyMetrics from 'src/components/backstage/playbooks/metrics/playbook_key_metrics';

import TitleBar from './title_bar';
import Outline from './tab_outline';

interface MatchParams {
    playbookId: string
}
const useFollowersMeta = (playbookId: string) => {
    const [followerIds, setFollowerIds] = useState<string[]>([]);
    const [isFollowing, setIsFollowing] = useState(false);
    const currentUserId = useSelector(getCurrentUserId);

    useEffect(() => {
        const fetchData = async () => {
            if (playbookId) {
                try {
                    const fetchedFollowerIds = await clientFetchPlaybookFollowers(playbookId);
                    setFollowerIds(fetchedFollowerIds);
                    setIsFollowing(fetchedFollowerIds?.includes(currentUserId));
                } catch {
                    setIsFollowing(false);
                }
            }
        };
        fetchData();
    }, [playbookId, currentUserId, isFollowing]);

    return {followerIds, isFollowing, setIsFollowing};
};

/** @alpha this is the new home of `playbooks/playbook.tsx`*/
const PlaybookEditor = () => {
    const {formatMessage} = useIntl();
    const {url, path, params: {playbookId}} = useRouteMatch<MatchParams>();

    const playbook = usePlaybook(playbookId);
    const stats = useStats(playbookId);
    const {
        followerIds,
        isFollowing,
        setIsFollowing,
    } = useFollowersMeta(playbookId);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    if (playbook === undefined) {
        // loading
        return null;
    }

    if (playbook === null) {
        // not found
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    return (
        <>
            <TitleBar
                playbook={playbook}
                isFollowing={isFollowing}
                onFollowingChange={setIsFollowing}
            />
            <Hero/>
            <Navbar>
                <NavItem
                    to={`${url}`}
                    exact={true}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_outline_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Outline'})}
                </NavItem>
                <NavItem
                    to={`${url}/usage`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_usage_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Usage'})}
                </NavItem>
                <NavItem
                    to={`${url}/reports`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_reports_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Reports'})}
                </NavItem>
            </Navbar>
            <ContentContainer>
                <Switch>
                    <Route
                        path={`${path}`}
                        exact={true}
                    >
                        <Outline
                            playbook={playbook}
                            followerIds={followerIds}
                            runsInProgress={stats.runs_in_progress}
                        />
                    </Route>
                    <Route path={`${path}/usage`}>
                        <PlaybookUsage
                            playbook={playbook}
                            stats={stats}
                        />
                    </Route>
                    <Route path={`${path}/reports`}>
                        <PlaybookKeyMetrics
                            playbook={playbook}
                            stats={stats}
                        />
                    </Route>
                </Switch>
            </ContentContainer>
        </>
    );
};

const Hero = styled.div`
    min-height: 200px;
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    text-align: center;
    padding: 20px 30px;
    font-weight: 600;

    && {
        color: rgba(var(--center-channel-color-rgb), 0.64);

        :hover {
            color: var(--button-bg);
        }

        :hover,
        :focus {
            text-decoration: none;
        }
    }

    &.active {
        color: var(--button-bg);
        box-shadow: inset 0px -3px 0px 0px var(--button-bg);
    }
`;

const Navbar = styled.nav`
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: center;
    margin: 0;
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
`;

const ContentContainer = styled.div`
    display: flex;
    flex: 1;
    justify-content: center;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);
`;

export default PlaybookEditor;
