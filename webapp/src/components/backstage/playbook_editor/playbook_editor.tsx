// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect, useMemo, useRef} from 'react';
import {
    NavLink,
    Redirect,
    Route,
    Switch,
    useRouteMatch,
} from 'react-router-dom';
import {generatePath} from 'react-router';

import {useIntl} from 'react-intl';

import {useIntersection} from 'react-use';
import {selectTeam} from 'mattermost-redux/actions/teams';
import {fetchChannelsAndMembers} from 'mattermost-redux/actions/channels';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {useDispatch, useSelector} from 'react-redux';
import {StarIcon, StarOutlineIcon} from '@mattermost/compass-icons/components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {pluginErrorUrl} from 'src/browser_routing';
import {useForceDocumentTitle, useStats} from 'src/hooks';
import {telemetryEventForPlaybook} from 'src/client';
import {ErrorPageTypes} from 'src/constants';
import PlaybookUsage from 'src/components/backstage/playbook_usage';
import PlaybookKeyMetrics from 'src/components/backstage/metrics/playbook_key_metrics';
import {SemiBoldHeading} from 'src/styles/headings';
import {HorizontalBG} from 'src/components/checklist/collapsible_checklist';
import CopyLink from 'src/components/widgets/copy_link';
import {usePlaybook, useUpdatePlaybook, useUpdatePlaybookFavorite} from 'src/graphql/hooks';
import MarkdownEdit from 'src/components/markdown_edit';
import TextEdit from 'src/components/text_edit';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import {CancelSaveContainer} from 'src/components/checklist_item/inputs';
import Tooltip from 'src/components/widgets/tooltip';
import {useDefaultRedirectOnTeamChange} from 'src/components/backstage/main_body';

import Outline, {ScrollNav, Sections} from './outline/outline';
import * as Controls from './controls';

const PlaybookEditor = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {path, params: {playbookId}} = useRouteMatch<{playbookId: string}>();

    const [playbook, {error, loading, refetch}] = usePlaybook(playbookId);
    const updatePlaybook = useUpdatePlaybook(playbook?.id);
    const updatePlaybookFavorite = useUpdatePlaybookFavorite(playbook?.id);
    const stats = useStats(playbookId);
    const currentUserId = useSelector(getCurrentUserId);

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    const headingRef = useRef<HTMLDivElement>(null);
    const headingIntersection = useIntersection(headingRef, {threshold: 1});
    const headingVisible = headingIntersection?.isIntersecting ?? true;

    useEffect(() => {
        const teamId = playbook?.team_id;
        if (!teamId) {
            return;
        }

        dispatch(selectTeam(teamId));
        dispatch(fetchChannelsAndMembers(teamId));
        dispatch(fetchMyCategories(teamId));
    }, [dispatch, playbook?.team_id, playbookId]);

    useDefaultRedirectOnTeamChange(playbook?.team_id);
    const currentUserMember = useMemo(() => playbook?.members.find(({user_id}) => user_id === currentUserId), [playbook?.members, currentUserId]);

    if (error) {
        // not found
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    if (loading || !playbook) {
        // loading
        return null;
    }

    const archived = playbook.delete_at !== 0;

    const archivedTooltip = archived && (
        <Tooltip
            delay={{show: 0, hide: 1000}}
            id={`archive-${playbook.id}`}
            content={formatMessage({defaultMessage: 'This playbook is archived.'})}
        >
            <i className='indicator icon-archive-outline'/>
        </Tooltip>
    );

    const privateTooltip = !playbook.public && (
        <Tooltip
            delay={{show: 0, hide: 1000}}
            id={`private-${playbook.id}`}
            content={formatMessage({defaultMessage: 'This playbook is private.'})}
        >
            <i className='indicator icon-lock-outline'/>
        </Tooltip>
    );

    // Favorite Button State
    const FavoriteIcon = playbook.is_favorite ? StarIcon : StarOutlineIcon;

    const toggleFavorite = () => {
        updatePlaybookFavorite(!playbook.is_favorite);
    };

    return (
        <Editor $headingVisible={headingVisible}>
            <TitleHeaderBackdrop/>
            <NavBackdrop/>
            <TitleBar>
                <div>
                    <StarButton onClick={toggleFavorite}>
                        <FavoriteIcon
                            size={18}
                            color={playbook.is_favorite ? 'var(--sidebar-text-active-border)' : 'var(--center-channel-color-56)'}
                        />
                    </StarButton>
                    <TextEdit
                        disabled={archived}
                        placeholder={formatMessage({defaultMessage: 'Playbook name'})}
                        value={playbook.title}
                        onSave={(title) => updatePlaybook({title})}
                        editStyles={css`
                            input {
                                ${titleCommon}
                                height: 36px;
                            }
                            ${CancelSaveContainer} {
                                padding: 0;
                            }
                            ${PrimaryButton}, ${TertiaryButton} {
                                height: 36px;
                            }
                        `}
                    >
                        {(edit) => (
                            <>

                                <Controls.TitleMenu
                                    playbook={playbook}
                                    editTitle={edit}
                                    refetch={refetch}
                                >
                                    <Title>
                                        {playbook.title}
                                    </Title>
                                </Controls.TitleMenu>
                                {privateTooltip}
                                {archivedTooltip}
                            </>

                        )}
                    </TextEdit>
                </div>
                <div>
                    {currentUserMember ? (
                        <>
                            <Controls.Members
                                playbookId={playbook.id}
                                numMembers={playbook.members.length}
                                refetch={refetch}
                            />
                            <Controls.AutoFollowToggle playbook={playbook}/>
                            <Controls.RunPlaybook playbook={playbook}/>
                        </>
                    ) : (
                        <Controls.JoinPlaybook
                            playbook={playbook}
                            refetch={refetch}
                        />
                    )}
                </div>
            </TitleBar>
            <Header ref={headingRef}>
                <TextEdit
                    placeholder={formatMessage({defaultMessage: 'Playbook name'})}
                    value={playbook.title}
                    onSave={(title) => updatePlaybook({title})}
                    editStyles={css`
                        input {
                            ${titleCommon}
                            font-size: 32px;
                            line-height: 40px;
                            height: 48px;
                            margin: 6px 0;
                            padding: 10px 16px;
                            display: inline-flex;
                            flex: 1 1 auto;
                        }
                        ${CancelSaveContainer} {
                            padding: 0;
                        }
                        ${PrimaryButton}, ${TertiaryButton} {
                            height: 48px;
                            font-size: 16px;
                        }
                    `}
                >
                    {(edit) => (
                        <Heading data-testid={'playbook-editor-header'}>
                            <Controls.CopyPlaybook playbook={playbook}/>
                            <Controls.TitleMenu
                                playbook={playbook}
                                editTitle={edit}
                                refetch={refetch}
                            >
                                <span data-testid={'playbook-editor-title'}>
                                    {playbook.title}
                                </span>
                            </Controls.TitleMenu>
                            {privateTooltip}
                            {archivedTooltip}
                        </Heading>
                    )}
                </TextEdit>
                <Description>
                    <MarkdownEdit
                        disabled={archived}
                        placeholder={formatMessage({defaultMessage: 'Add a description…'})}
                        value={playbook.description}
                        onSave={(description) => updatePlaybook({description})}
                        noBorder={true}
                    />
                </Description>
            </Header>
            <NavBar>
                <NavItem
                    to={generatePath(path, {playbookId})}
                    exact={true}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_usage_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Usage'})}
                </NavItem>
                <NavItem
                    to={generatePath(path, {playbookId, tab: 'outline'})}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_outline_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Outline'})}
                </NavItem>
                <NavItem
                    to={generatePath(path, {playbookId, tab: 'reports'})}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_reports_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Reports'})}
                </NavItem>
            </NavBar>
            <Switch>
                <Route
                    path={generatePath(path, {playbookId})}
                    exact={true}
                >
                    <PlaybookUsage
                        playbookID={playbook.id}
                        stats={stats}
                    />
                </Route>
                <Route
                    path={generatePath(path, {playbookId, tab: 'outline'})}
                    exact={true}
                >
                    <Outline
                        playbook={playbook}
                        refetch={refetch}
                    />
                </Route>
                <Route
                    path={generatePath(path, {playbookId, tab: 'reports'})}
                    exact={true}
                >
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

const titleCommon = css`
    ${SemiBoldHeading};
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
`;

const TitleBar = styled.div`
    position: sticky;
    z-index: 5;
    top: 0;
    display: flex;
    justify-content: space-between;
    padding: 0 2rem;
    margin-bottom: 1px; /* keeps box-shadow visible */
    grid-area: title;

    > div {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    ${Controls.TitleButton} {
        padding-left: 8px;
    }

    /* === blur/cutoff === */
    &::before {
        position: absolute;
        z-index: -1;
        top: 0;
        left: 0;
        display: block;
        width: 100%;
        height: var(--bar-height);
        background-color: var(--center-channel-bg);
        content: '';
        mask: linear-gradient(black, black, transparent);
    }
`;

const Header = styled.header`
    z-index: 4;
    grid-area: header;

    ${CopyLink} {
        width: 40px;
        height: 40px;
        margin-left: -40px;
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
    font-size: 16px;
    line-height: 24px;
    color: var(--center-channel-color);
    height: 24px;
    margin: 0;

    ${titleMenuOverrides}
`;

const Description = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
`;

const NavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    padding: 20px 30px;
    font-weight: 600;
    text-align: center;

    && {
        color: rgba(var(--center-channel-color-rgb), 0.64);

        &:hover {
            color: var(--button-bg);
        }

        &:hover,
        &:focus {
            text-decoration: none;
        }
    }

    &.active {
        box-shadow: inset 0 -3px 0 0 var(--button-bg);
        color: var(--button-bg);
    }
`;

const NavBar = styled.nav`
    z-index: 2;
    display: flex;
    width: 100%;
    justify-content: center;
    grid-area: nav;
`;

const NavBackdrop = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
    grid-area: nav-left/nav-left/nav-right/nav-right;
`;

const TitleHeaderBackdrop = styled.div`
    background: var(--center-channel-bg);
    grid-area: title/title/control/title;
`;

const Editor = styled.main<{$headingVisible: boolean}>`
    height: fit-content;
    min-height: 100%;
    display: grid;
    background-color: rgba(var(--center-channel-color-rgb), 0.04);

    --markdown-textbox-radius: 8px;
    --markdown-textbox-padding: 12px 16px;
    --bar-height: 60px;
    --content-max-width: 1100px;

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
        position: sticky;
        top: var(--bar-height);
        min-width: 145px;
        padding-top: 1rem;
        margin-top: 8.25rem;
        margin-right: 1.5rem;
        margin-left: 1.5rem;
        grid-area: aside;
        place-self: start end;
    }


    ${Sections} {
        margin: 5rem 1.5rem;
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

    ${TitleBar} {
        ${Controls.TitleMenu}, .indicator {
            display: none;
        }
    }

    /* === scrolling, condense header/title === */
    ${({$headingVisible}) => !$headingVisible && css`
        @media screen and (width >= 769px) {
            /* // only on tablet-desktop */
            ${TitleBar} {
                ${Controls.TitleMenu}, .indicator {
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
    @media screen and (width <= 768px) {
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

    @media screen and (width <= 1266px) {
        ${ScrollNav} {
            display: none;
        }
    }
`;

export const StarButton = styled.button`
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    border: 0;
    border-radius: 4px;
    margin: 0 6px;
    background: none;

    &:hover {
       background: rgba(var(--center-channel-color-rgb), 0.08);
       color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;
export default PlaybookEditor;
