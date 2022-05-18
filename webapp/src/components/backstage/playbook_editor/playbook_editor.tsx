// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect} from 'react';
import {Switch, Route, Redirect, NavLink, useRouteMatch} from 'react-router-dom';

import {useIntl, FormattedMessage, FormattedNumber} from 'react-intl';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchMyChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {useDispatch} from 'react-redux';

import Icon from '@mdi/react';
import {mdiClipboardPlayMultipleOutline} from '@mdi/js';

import {pluginErrorUrl} from 'src/browser_routing';
import {
    useForceDocumentTitle,
    useStats,
    useMarkdownRenderer,
} from 'src/hooks';

import {
    getSiteUrl,
    telemetryEventForPlaybook,
} from 'src/client';
import {ErrorPageTypes} from 'src/constants';

import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookKeyMetrics from 'src/components/backstage/playbooks/metrics/playbook_key_metrics';

import {SemiBoldHeading} from 'src/styles/headings';

import {HorizontalBG} from 'src/components/collapsible_checklist';

import CopyLink from 'src/components/widgets/copy_link';

import {usePlaybook} from 'src/graphql/hooks';

import Outline, {Sections, ScrollNav} from './outline/outline';
import * as Controls from './controls';

interface MatchParams {
    playbookId: string
}

/** @alpha this is the new home of `playbooks/playbook.tsx`*/
const PlaybookEditor = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {url, path, params: {playbookId}} = useRouteMatch<MatchParams>();

    const [playbook, {error, loading}] = usePlaybook(playbookId);
    const stats = useStats(playbookId);
    const renderMarkdown = useMarkdownRenderer(playbook?.team_id);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

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

    return (
        <>
            <Editor>
                <TitleHeaderBackdrop/>
                <NavBackdrop/>
                <TitleWing side='left'>
                    <Controls.Back/>
                    <Controls.TitleMenu playbook={playbook}>
                        <Title>
                            {playbook.title}
                        </Title>
                    </Controls.TitleMenu>
                </TitleWing>
                <TitleWing side='right'>
                    <Controls.RunPlaybook playbook={playbook}/>
                </TitleWing>
                <Header>
                    <Heading>
                        <CopyLink
                            id='copy-playbook-link-tooltip'
                            to={getSiteUrl() + '/playbooks/playbooks/' + playbook.id}
                            name={playbook.title}
                            area-hidden={true}
                        />
                        <Controls.TitleMenu playbook={playbook}>
                            {playbook.title}
                        </Controls.TitleMenu>
                    </Heading>
                    <ControlBar>
                        {playbook.public === false && (
                            <Controls.MetaItem>
                                <i className={'icon icon-lock-outline'}/>
                                <FormattedMessage defaultMessage='Private'/>
                            </Controls.MetaItem>
                        )}
                        <Controls.Members
                            playbookId={playbook.id}
                            numMembers={playbook.members.length}
                        />
                        <Controls.MetaItem>
                            <Icon
                                path={mdiClipboardPlayMultipleOutline}
                                size={1.25}
                            />
                            <FormattedNumber value={stats.runs_in_progress}/>
                        </Controls.MetaItem>
                        <Controls.AutoFollowToggle playbook={playbook}/>
                    </ControlBar>
                    <Description>{renderMarkdown(playbook.description)}</Description>
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
                        />
                    </Route>
                    <Route path={`${path}/usage`}>
                        <PlaybookUsage
                            playbookID={playbook.id}
                            stats={stats}
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
        </>
    );
};

const ControlBar = styled.div`
    padding-bottom: 1rem;
    display: flex;
`;

const TitleWing = styled.div<{side: 'left' | 'right'}>`
    position: sticky;
    z-index: 3;
    top: 0;
    grid-area: ${({side}) => `title-${side}`};

    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: ${({side}) => (side === 'left' ? 'start' : 'end')};
`;

const Header = styled.header`
    grid-area: header;
    z-index: 4;

    ${CopyLink} {
        margin-left: -1.25em;
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

    &:not(:hover) ${CopyLink}:not(:hover) {
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
    margin-left: 8px;

    ${titleMenuOverrides}
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
    display: flex;
    width: 100%;
    justify-content: center;
    grid-area: nav;
    position: sticky;
    top: 0;
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
    grid-area: title-left/title-left/control/title-right;
`;

const Editor = styled.main`
    min-height: 100%;
    display: grid;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);

    --bar-height: 60px;
    --content-max-width: 780px;

    /* === standard-full === */
    grid-template:
        'title-left title-left . title-right title-right' var(--bar-height)
        '. header header header .'
        '. control control control .'
        'nav-left nav-left nav nav-right nav-right' var(--bar-height)
        'aside content content content .' 1fr
        / 1fr 1fr minmax(min-content, auto) 1fr 1fr;
    ;

    gap: 0 3rem;

    ${Header} ${Controls.TitleMenu} {
        i.icon {
            font-size: 3.5rem;
        }
    }

    ${ScrollNav} {
        grid-area: aside;
        align-self: start;
        justify-self: end;

        margin-top: 10rem;

        position: sticky;
        top: var(--bar-height);
    }


    ${Sections} {
        margin-top: 5rem;
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

    ${TitleWing} {
        ${Controls.TitleMenu} {
            display: none;
        }
    }
    /* === scrolling, condense header/title === */
    .is-scrolling & {
        ${TitleWing} {
            ${Controls.TitleMenu} {
                display: inline-flex;
                margin-left: 8px;
            }
        }
        ${Controls.Back} {
            span {
                display: none;
            }
        }
    }

    /* === mobile === */
    @media screen and (max-width: 768px) {

        --bar-height: 50px;

        grid-template:
            'title-left title-right' var(--bar-height)
            'header header'
            'control control'
            'nav nav'
            'content content'
            / 1fr
        ;

        ${Controls.Back} {
            span {
                display: none;
            }
        }

        ${Header} {
            padding: 20px;
        }

        ${NavBar},
        ${TitleWing} {
            position: unset;
        }

        ${NavBackdrop} {
            position: unset;
            grid-area: nav;
        }

        ${Sections} {
            padding: 20px;
            padding-top: 0;
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

    @media screen and (max-width: 1021px) {
        gap: 0;
    }

    @media screen and (min-width: 1021px) {
    }

    @media screen and (min-width: 1267px) {
        --content-max-width: 900px;
    }

    @media screen and (min-width: 1680px) {
        --content-max-width: 1100px;
    }
`;

export default PlaybookEditor;
