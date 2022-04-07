// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
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
    getSiteUrl,
    telemetryEventForPlaybook,
} from 'src/client';
import {ErrorPageTypes} from 'src/constants';

import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookKeyMetrics from 'src/components/backstage/playbooks/metrics/playbook_key_metrics';

import {SemiBoldHeading} from 'src/styles/headings';

import {HorizontalBG} from 'src/components/collapsible_checklist';

import TitleBar from './title_bar';
import Outline, {Sections, ScrollNav} from './outline/outline';
import CopyLink from './copy_link';

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
            <Editor>
                <TitleBar
                    playbook={playbook}
                    isFollowing={isFollowing}
                    onFollowingChange={setIsFollowing}
                />
                <HeaderNavBackdrop/>
                <Header>
                    <Heading>
                        {playbook.title}
                        <CopyLink
                            id='copy-playbook-link-tooltip'
                            to={getSiteUrl() + '/playbooks/playbooks/' + playbook.id}
                            name={playbook.title}
                        />
                    </Heading>
                    <Description>{playbook.description}</Description>
                </Header>
                <NavBar>
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
                </NavBar>
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
            </Editor>
        </>
    );
};

const frag = css`
    /* === Responsiveness === */
    --list: minmax(min-content, 300px);
    --pane: minmax(min-content, auto);

    display: grid;
    overflow: hidden;
    grid-template-areas:
        'header header'
        'list pane';

    // 2-column
    grid-template-columns: var(--list) var(--pane);
    grid-template-rows: 63px 1fr;

    // single column
    @media screen and (max-width: 1020px) {
        grid-template-areas:
            'header header'
            'main main';

        &.thread-selected {
            .ThreadList {
                display: none;
            }

            .ThreadPane {
                grid-area: main;

                .Header {
                    padding-left: 5px;
                }

                .back {
                    display: unset;
                }
            }
        }
    }

    @media screen and (max-width: 768px) {
        grid-template-rows: 0 1fr;
    }

    @media screen and (min-width: 1021px) {
        --list: minmax(min-content, 350px);
    }

    @media screen and (min-width: 1267px) {
        --list: minmax(min-content, 400px);
    }

    @media screen and (min-width: 1680px) {
        --list: minmax(min-content, 500px);
    }
 `;

const Header = styled.div`
    padding-top: 3rem;
    min-height: 20rem;
`;

const Heading = styled.h1`
    ${SemiBoldHeading}
    margin-bottom: 24px;

    &:not(:hover) ${CopyLink} {
        visibility: hidden;
    }
`;

const Description = styled.p`
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);

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

const NavBar = styled.nav`
    display: inline-flex;
    height: 100%;
    justify-self: center;

    position: sticky;
    top: 0;
    z-index: 3;
`;

const HeaderNavBackdrop = styled.div`
    background: var(--center-channel-bg);
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
    grid-area: header-left/nav/nav/header-right;
`;

const Editor = styled.main`
    display: grid;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);


    --bar-height: 66px;
    --content-max-width: 780px;

    // standard-full
    grid-template:
        'title-bar title-bar title-bar' var(--bar-height)
        'header-left header header-right' minmax(min-content, auto)
        'nav nav nav' var(--bar-height)
        'aside content aside-right' 1fr
        / 1fr minmax(min-content, var(--content-max-width)) 1fr
    ;

    row-gap: 1rem 1rem 7rem;
    column-gap: 3rem;

    ${TitleBar} {
        grid-area: title-bar;
    }

    ${Header} {
        grid-area: header;
    }

    ${NavBar} {
        grid-area: nav;
    }

    ${ScrollNav} {
        grid-area: aside;
        align-self: start;
        justify-self: end;

        margin-top: 9.5rem;

        position: sticky;
        top: 80px;
    }


    ${Sections} {
        margin-top: 5rem;
        grid-area: content;

        ${HorizontalBG} {
            /* sticky checklist header */
            top: var(--bar-height);
        }
    }

    ${PlaybookUsage},
    ${PlaybookKeyMetrics} {
        grid-area: aside/aside/aside-right/aside-right;
    }

    // mobile
    @media screen and (max-width: 768px) {
        grid-template:
            'title-bar'
            'header'
            'nav'
            'content'
        ;

        grid-auto-columns: 1fr;
        ${Sections} {
            padding: 20px;
        }

        ${ScrollNav} {
            display: none;
        }
    }

    @media screen and (max-width: 768px) {
    }

    @media screen and (min-width: 1021px) {
    }

    @media screen and (min-width: 1267px) {
    }

    @media screen and (min-width: 1680px) {
        --content-max-width: 900px;
    }
`;

export default PlaybookEditor;
