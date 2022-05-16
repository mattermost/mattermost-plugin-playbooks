// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useRef, useState, useEffect, useCallback} from 'react';
import {Switch, Route, Redirect, NavLink, useRouteMatch} from 'react-router-dom';

import {useIntl} from 'react-intl';

import {useIntersection, useUpdateEffect} from 'react-use';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {useDispatch} from 'react-redux';

import {pluginErrorUrl} from 'src/browser_routing';
import {
    useForceDocumentTitle,
    useStats,
} from 'src/hooks';

import {telemetryEventForPlaybook} from 'src/client';
import {ErrorPageTypes} from 'src/constants';

import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookKeyMetrics from 'src/components/backstage/playbooks/metrics/playbook_key_metrics';

import {SemiBoldHeading} from 'src/styles/headings';

import {HorizontalBG} from 'src/components/checklist/collapsible_checklist';

import CopyLink from 'src/components/widgets/copy_link';

import {usePlaybook, useUpdatePlaybook} from 'src/graphql/hooks';

import MarkdownEdit from 'src/components/markdown_edit';

import Outline, {Sections, ScrollNav} from './outline/outline';

import * as Controls from './controls';

const PlaybookEditor = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {url, path, params: {playbookId}} = useRouteMatch<{playbookId: string}>();

    const [playbook, {error, loading}] = usePlaybook(playbookId);
    const updatePlaybook = useUpdatePlaybook(playbook?.id);
    const stats = useStats(playbookId);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    const headingRef = useRef<HTMLHeadingElement>(null);
    const headingIntersection = useIntersection(headingRef, {threshold: 0.8});
    const headingVisible = headingIntersection?.isIntersecting ?? true;

    useEffect(() => {
        const teamId = playbook?.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchMyChannelsAndMembers(teamId));
        dispatch(fetchMyCategories(teamId));
    }, [dispatch, playbook?.team_id]);

    if (error) {
        // not found
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    if (loading || !playbook) {
        // loading
        return null;
    }

    const archived = playbook.delete_at !== 0;

    return (
        <Editor $headingVisible={headingVisible}>
            <TitleHeaderBackdrop/>
            <NavBackdrop/>
            <TitleBar>
                <div>
                    <Controls.Back/>
                    <Controls.TitleMenu
                        playbook={playbook}
                        archived={archived}
                    >
                        <Title>
                            {playbook.title}
                        </Title>
                    </Controls.TitleMenu>
                </div>
                <div>
                    <Controls.Members
                        playbookId={playbook.id}
                        numMembers={playbook.members.length}
                    />
                    {/* <Controls.Share playbook={playbook}/> */}
                    <Controls.AutoFollowToggle playbook={playbook}/>
                    <Controls.RunPlaybook playbook={playbook}/>
                </div>
            </TitleBar>
            <Header>
                <Heading ref={headingRef}>
                    <Controls.CopyPlaybook playbook={playbook}/>
                    <Controls.TitleMenu
                        playbook={playbook}
                        archived={archived}
                    >
                        {playbook.title}
                    </Controls.TitleMenu>
                </Heading>
                <Description>
                    <MarkdownEdit
                        placeholder={formatMessage({defaultMessage: 'Add a description…'})}
                        value={playbook.description}
                        onSave={(description) => updatePlaybook({description})}
                        noBorder={true}
                    />
                </Description>
            </Header>
            <NavBar>
                <NavItem
                    to={`${url}`}
                    exact={true}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_usage_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Usage'})}
                </NavItem>
                <NavItem
                    to={`${url}/outline`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_outline_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Outline'})}
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
                    <PlaybookUsage
                        playbookID={playbook.id}
                        stats={stats}
                    />
                </Route>
                <Route path={`${path}/outline`}>
                    <Outline
                        playbook={playbook}
                    />
                </Route>
                <Route path={`${path}/reports`}>
                    <PlaybookKeyMetrics
                        playbookID={playbook.id}
                        playbookMetrics={playbook.metrics}
                        stats={stats}
                    />
                </Route>
            </Switch>
        </Editor>
    );
};

const TitleBar = styled.div`
    position: sticky;
    z-index: 5;
    top: 0;
    grid-area: title;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    > div {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    margin-bottom: 1px; // keeps box-shadow visible

    ${Controls.TitleButton} {
        padding-left: 8px;
    }

    // === blur/cutoff ===
    &::before {
        width: 100%;
        height: var(--bar-height);
        display: block;
        content: '';
        position: absolute;
        z-index: -1;
        left: 0;
        top: 0;
        background-color: var(--center-channel-bg);
        mask: linear-gradient(black, black, transparent);
    }
`;

const Header = styled.header`
    grid-area: header;
    z-index: 4;

    ${CopyLink} {
        margin-left: -40px;
        height: 40px;
        width: 40px;
        font-size: 24px;
        opacity: 1;
        transition: opacity ease 0.15s;
    }
`;

const titleMenuOverrides = css`
    ${Controls.TitleMenu} {
        margin: 0;
        color: var(--center-channel-color);
        &:hover,
        &:focus {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
            text-decoration: none;
        }
    }
`;

const Heading = styled.h1`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 32px;
    line-height: 40px;
    color: var(--center-channel-color);

    min-height: var(--bar-height);
    display: inline-flex;
    align-items: center;
    margin: 0;

    &:not(:hover) ${CopyLink}:not(:hover, :focus) {
        opacity: 0;
    }
    ${titleMenuOverrides}
`;

const Title = styled.h1`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);

    height: 24px;
    margin: 0;

    ${titleMenuOverrides}
`;

const Description = styled.div`
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
    display: flex;
    width: 100%;
    justify-content: center;
    grid-area: nav;
    z-index: 2;
`;

const NavBackdrop = styled.div`
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--center-channel-bg);
    grid-area: nav-left/nav-left/nav-right/nav-right;
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
`;

const TitleHeaderBackdrop = styled.div`
    background: var(--center-channel-bg);
    grid-area: title/title/control/title;
`;

const Editor = styled.main<{$headingVisible: boolean}>`
    min-height: 100%;
    display: grid;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);

    --markdown-textbox-radius: 8px;
    --markdown-textbox-padding: 12px 16px;

    --bar-height: 60px;
    --content-max-width: 780px;

    /* === standard-full === */
    grid-template:
        'title title title' var(--bar-height)
        '. header .'
        '. control .'
        'nav-left nav nav-right' var(--bar-height)
        'aside content aside-right' 1fr
        / 1fr minmax(auto, var(--content-max-width)) 1fr;
    ;

    ${Header} {
        ${Controls.TitleMenu} {
            i.icon {
                font-size: 3.5rem;
            }
        }
    }

    ${ScrollNav} {
        grid-area: aside;
        align-self: start;
        justify-self: end;

        margin-top: 8.25rem;
        padding-top: 1rem;

        position: sticky;
        top: var(--bar-height);
    }


    ${Sections} {
        margin: 5rem 1.5rem;
        grid-area: content;

        ${HorizontalBG} {
            /* sticky checklist header */
            top: var(--bar-height);
            z-index: 1;
        }
    }

    ${PlaybookUsage},
    ${PlaybookKeyMetrics} {
        grid-area: aside/aside/aside-right/aside-right;
    }

    ${TitleBar} {
        ${Controls.TitleMenu} {
            display: none;
        }
    }

    /* === scrolling, condense header/title === */
    ${({$headingVisible}) => !$headingVisible && css`
        @media screen and (min-width: 769px) {
            // only on tablet-desktop
            ${TitleBar} {
                ${Controls.TitleMenu} {
                    display: inline-flex;
                }
            }
        }
        ${Controls.Back} {
            span {
                display: none;
            }
        }
    `}

    /* === mobile === */
    @media screen and (max-width: 768px) {
        --bar-height: 50px;

        grid-template:
            'title' var(--bar-height)
            'header'
            'control'
            'nav'
            'content'
            / 1fr
        ;

        ${Controls.Back} {
            span {
                display: none;
            }
        }

        ${PlaybookUsage},
        ${PlaybookKeyMetrics} {
            grid-area: content;
        }

        ${Header} {
            padding: 20px;
        }

        ${NavBar},
        ${TitleBar} {
            position: unset;
        }

        ${NavBackdrop} {
            position: unset;
            grid-area: nav;
        }

        ${Sections} {
            padding: 15px 20px 20px;
            margin: 10px;
        }

        ${ScrollNav} {
            display: none;
        }

        ${HorizontalBG} {
            /* non-sticky checklist header */
            position: unset;
        }
    }

    @media screen and (max-width: 1266px) {
        ${ScrollNav} {
            display: none;
        }
    }
    @media screen and (min-width: 1267px) {
        --content-max-width: 900px;
    }

    @media screen and (min-width: 1680px) {
        --content-max-width: 1100px;
    }
`;

export default PlaybookEditor;
