// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Switch, Route, Redirect, NavLink, useRouteMatch} from 'react-router-dom';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline} from '@mdi/js';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Client4} from 'mattermost-redux/client';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId, getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {FormattedMessage, useIntl} from 'react-intl';

import {navigateToUrl, navigateToPluginUrl, pluginErrorUrl} from 'src/browser_routing';
import {useForceDocumentTitle, useHasPlaybookPermission, useStats} from 'src/hooks';
import PlaybookUsage from 'src/components/backstage/playbooks/playbook_usage';
import PlaybookPreview from 'src/components/backstage/playbooks/playbook_preview';
import {useToaster} from '../toast_banner';

import {
    clientFetchPlaybookFollowers,
    clientFetchPlaybook,
    duplicatePlaybook as clientDuplicatePlaybook,
    autoFollowPlaybook,
    autoUnfollowPlaybook,
    telemetryEventForPlaybook,
    playbookExportProps,
    archivePlaybook,
    createPlaybookRun,
    getSiteUrl,
} from 'src/client';
import {ErrorPageTypes, OVERLAY_DELAY} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {PrimaryButton} from 'src/components/assets/buttons';
import {RegularHeading} from 'src/styles/headings';
import CheckboxInput from '../runs_list/checkbox_input';
import {SecondaryButtonLargerRight} from '../playbook_runs/shared';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';

import CopyLink from 'src/components/widgets/copy_link';
import {displayEditPlaybookAccessModal} from 'src/actions';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import DotMenu, {DropdownMenuItem, DropdownMenuItemStyled} from 'src/components/dot_menu';
import useConfirmPlaybookArchiveModal from '../archive_playbook_modal';
import {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip/hooks';
import {PlaybookPreviewTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';
import TutorialTourTip from 'src/components/tutorial/tutorial_tour_tip';
import PlaybookKeyMetrics from 'src/components/backstage/playbooks/metrics/playbook_key_metrics';

interface MatchParams {
    playbookId: string
}

const LEARN_PLAYBOOKS_TITLE = 'Learn how to use playbooks';

const FetchingStateType = {
    loading: 'loading',
    fetched: 'fetched',
    notFound: 'notfound',
};

const MembersIcon = styled.div`
    display: inline-block;
    font-size: 12px;
    border-radius: 4px;
    padding: 0 8px;
    font-weight: 600;
    margin: 2px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    height: 28px;
    line-height: 28px;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const TitleButton = styled.div`
    margin-left: 20px;
    display: inline-flex;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    fill: rgba(var(--center-channel-color-rgb), 0.64);

    &:hover {
        background: rgba(var(--link-color-rgb), 0.08);
        color: rgba(var(--link-color-rgb), 0.72);
    }
`;

const RedText = styled.div`
    color: var(--error-text);
`;

const StyledCopyLink = styled(CopyLink)`
    border-radius: 4px;
    font-size: 18px;
    width: 24px;
    height: 24px;
    line-height: 18px;
    margin-left: 8px;
`;

/** @deprecated this page and potentially some inner sections will be deprecated in the future. See `playbook_editor/playbook_editor.tsx`. */
const Playbook = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const match = useRouteMatch<MatchParams>();
    const [playbook, setPlaybook] = useState<PlaybookWithChecklist>();
    const [followerIds, setFollowerIds] = useState<string[]>([]);
    const [fetchingState, setFetchingState] = useState(FetchingStateType.loading);
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const stats = useStats(match.params.playbookId);
    const [isFollowed, setIsFollowed] = useState(false);
    const currentUserId = useSelector(getCurrentUserId);
    const currentUser = useSelector(getCurrentUser);
    const [modal, openDeletePlaybookModal] = useConfirmPlaybookArchiveModal(() => {
        if (playbook) {
            archivePlaybook(playbook.id);
            navigateToPluginUrl('/playbooks');
        }
    });
    const addToast = useToaster().add;
    const punchoutTitleRow = useMeasurePunchouts(['title-row'], [], {y: -5, height: 10, x: -5, width: 10});
    const showRunButtonTutorial = useShowTutorialStep(PlaybookPreviewTutorialSteps.RunButton, TutorialTourCategories.PLAYBOOK_PREVIEW);

    const changeFollowing = (check: boolean) => {
        if (playbook?.id) {
            if (check) {
                autoFollowPlaybook(playbook.id, currentUserId);
            } else {
                autoUnfollowPlaybook(playbook.id, currentUserId);
            }
            setIsFollowed(check);
        }
    };

    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);

    const isTutorialPlaybook = playbook?.title === LEARN_PLAYBOOKS_TITLE;

    useForceDocumentTitle(playbook?.title ? (playbook.title + ' - Playbooks') : 'Playbooks');

    const goToPlaybooks = () => {
        navigateToPluginUrl('/playbooks');
    };

    const runPlaybook = async () => {
        if (playbook && isTutorialPlaybook) {
            const playbookRun = await createPlaybookRun(playbook.id, currentUserId, playbook.team_id, `${currentUser.username}'s onboarding run`, playbook.description);
            const channel = await Client4.getChannel(playbookRun.channel_id);
            const pathname = `/${team.name}/channels/${channel.name}`;
            const search = '?forceRHSOpen&openTakeATourDialog';
            navigateToUrl({pathname, search});
            return;
        }
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
    }, [match.params.playbookId, currentUserId]);

    useEffect(() => {
        const fetchData = async () => {
            const playbookId = match.params.playbookId;
            if (playbookId) {
                try {
                    const fetchedFollowerIds = await clientFetchPlaybookFollowers(playbookId);
                    setFollowerIds(fetchedFollowerIds);
                    setIsFollowed(fetchedFollowerIds.includes(currentUserId));
                } catch {
                    setIsFollowed(false);
                }
            }
        };
        fetchData();
    }, [match.params.playbookId, currentUserId, isFollowed]);

    if (fetchingState === FetchingStateType.loading) {
        return null;
    }

    if (fetchingState === FetchingStateType.notFound || !playbook) {
        return <Redirect to={pluginErrorUrl(ErrorPageTypes.PLAYBOOKS)}/>;
    }

    let accessIconClass;
    if (playbook.public) {
        accessIconClass = 'icon-globe';
    } else {
        accessIconClass = 'icon-lock-outline';
    }

    let toolTipText = formatMessage({defaultMessage: 'Select this to automatically receive updates when this playbook is run.'});
    if (isFollowed) {
        toolTipText = formatMessage({defaultMessage: 'You automatically receive updates when this playbook is run.'});
    }

    const tooltip = (
        <Tooltip id={`auto-follow-tooltip-${isFollowed}`}>
            {toolTipText}
        </Tooltip>
    );

    const archived = playbook?.delete_at !== 0;
    const enableRunPlaybook = !archived && hasPermissionToRunPlaybook;
    const [exportHref, exportFilename] = playbookExportProps(playbook);

    return (
        <>
            <TopContainer
                id='title-row'
            >
                <TitleRow>
                    <LeftArrow
                        className='icon-arrow-left'
                        onClick={goToPlaybooks}
                    />
                    <DotMenu
                        dotMenuButton={TitleButton}
                        placement='bottom-end'
                        icon={
                            <>
                                <i className={'icon ' + accessIconClass}/>
                                <Title>{playbook.title}</Title>
                                <i className={'icon icon-chevron-down'}/>
                            </>
                        }
                    >
                        <DropdownMenuItem
                            onClick={() => dispatch(displayEditPlaybookAccessModal(playbook.id))}
                        >
                            <FormattedMessage defaultMessage='Manage access'/>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={async () => {
                                const newID = await clientDuplicatePlaybook(playbook.id);
                                navigateToPluginUrl(`/playbooks/${newID}`);
                                addToast(formatMessage({defaultMessage: 'Successfully duplicated playbook'}));
                                telemetryEventForPlaybook(playbook.id, 'playbook_duplicate_clicked_in_playbook');
                            }}
                        >
                            <FormattedMessage defaultMessage='Duplicate'/>
                        </DropdownMenuItem>
                        <DropdownMenuItemStyled
                            href={exportHref}
                            download={exportFilename}
                            role={'button'}
                            onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_export_clicked_in_playbook')}
                        >
                            <FormattedMessage defaultMessage='Export'/>
                        </DropdownMenuItemStyled>
                        {!archived &&
                            <DropdownMenuItem
                                onClick={() => openDeletePlaybookModal(playbook)}
                            >
                                <RedText>
                                    <FormattedMessage defaultMessage='Archive playbook'/>
                                </RedText>
                            </DropdownMenuItem>
                        }
                    </DotMenu>
                    <MembersIcon
                        onClick={() => dispatch(displayEditPlaybookAccessModal(playbook.id))}
                    >
                        <i className={'icon icon-account-multiple-outline'}/>
                        {playbook.members.length}
                    </MembersIcon>
                    {
                        archived &&
                        <StatusBadge
                            data-testid={'archived-badge'}
                            status={BadgeType.Archived}
                        />
                    }
                    <StyledCopyLink
                        id='copy-playbook-link-tooltip'
                        to={getSiteUrl() + '/playbooks/playbooks/' + playbook.id}
                        tooltipMessage={formatMessage({defaultMessage: 'Copy link to playbook'})}
                    />
                    <SecondaryButtonLargerRightStyled
                        checked={isFollowed}
                        disabled={archived}
                    >
                        <OverlayTrigger
                            placement={'bottom'}
                            delay={OVERLAY_DELAY}
                            overlay={tooltip}
                        >
                            <div>
                                <CheckboxInputStyled
                                    testId={'auto-follow-runs'}
                                    text={'Auto-follow runs'}
                                    checked={isFollowed}
                                    disabled={archived}
                                    onChange={changeFollowing}
                                />
                            </div>
                        </OverlayTrigger>
                    </SecondaryButtonLargerRightStyled>
                    <PrimaryButtonLarger
                        onClick={runPlaybook}
                        disabled={!enableRunPlaybook}
                        title={enableRunPlaybook ? formatMessage({defaultMessage: 'Run Playbook'}) : formatMessage({defaultMessage: 'You do not have permissions'})}
                        data-testid='run-playbook'
                    >
                        <RightMarginedIcon
                            path={mdiClipboardPlayOutline}
                            size={1.25}
                        />
                        {isTutorialPlaybook ? formatMessage({defaultMessage: 'Start a test run'}) : formatMessage({defaultMessage: 'Run'})}
                    </PrimaryButtonLarger>
                    {showRunButtonTutorial &&
                        <TutorialTourTip
                            {...isTutorialPlaybook ? {
                                title: formatMessage({defaultMessage: 'Test your new playbook out!'}),
                                screen: formatMessage({defaultMessage: 'Select <strong>Start a test run</strong> to see it in action.'}, {strong: (x) => <strong>{x}</strong>}),
                            } : {
                                title: formatMessage({defaultMessage: 'Ready to run your playbook?'}),
                                screen: formatMessage({defaultMessage: 'Select <strong>Run</strong> to see it in action.'}, {strong: (x) => <strong>{x}</strong>}),
                            }}
                            tutorialCategory={TutorialTourCategories.PLAYBOOK_PREVIEW}
                            step={PlaybookPreviewTutorialSteps.RunButton}
                            placement='bottom-end'
                            pulsatingDotPlacement='right'
                            pulsatingDotTranslate={{x: -90, y: 15}}
                            autoTour={true}
                            width={352}
                            punchOut={punchoutTitleRow}
                            telemetryTag={`tutorial_tip_Playbook_Preview_${PlaybookPreviewTutorialSteps.RunButton}_RunButton`}
                        />
                    }
                </TitleRow>
            </TopContainer>
            <Navbar>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/preview`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_preview_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Preview'})}
                </NavItem>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/usage`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_usage_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Usage'})}
                </NavItem>
                <NavItem
                    activeStyle={activeNavItemStyle}
                    to={`${match.url}/metrics`}
                    onClick={() => telemetryEventForPlaybook(playbook.id, 'playbook_metrics_tab_clicked')}
                >
                    {formatMessage({defaultMessage: 'Key metrics'})}
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
                        followerIds={followerIds}
                        runsInProgress={stats.runs_in_progress}
                    />
                </Route>
                <Route path={`${match.path}/usage`}>
                    <PlaybookUsage
                        playbookID={playbook.id}
                        stats={stats}
                    />
                </Route>
                <Route path={`${match.path}/metrics`}>
                    <PlaybookKeyMetrics
                        playbookID={playbook.id}
                        playbookMetrics={playbook.metrics}
                        stats={stats}
                    />
                </Route>
            </Switch>
            {modal}
        </>
    );
};

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
    box-shadow: inset 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.16);
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
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;
const Title = styled.div`
    ${RegularHeading} {
    }

    font-size: 20px;
    line-height: 28px;
    color: var(--center-channel-color);
    margin-left: 6px;
    margin-right: 6px;
`;

const PrimaryButtonLarger = styled(PrimaryButton)`
    padding: 0 16px;
    height: 36px;
    margin-left: 12px;
`;

const CheckboxInputStyled = styled(CheckboxInput)`
    padding-right: 4px;
    padding-left: 4px;
    font-size: 14px;

    &:hover {
        background-color: transparent;
    }
`;

interface CheckedProps {
    checked: boolean;
}

const SecondaryButtonLargerRightStyled = styled(SecondaryButtonLargerRight) <CheckedProps>`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover:enabled {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${(props: CheckedProps) => props.checked && css`
        border: 1px solid var(--button-bg);
        color: var(--button-bg);

        &:hover:enabled {
            background-color: rgba(var(--button-bg-rgb), 0.12);
        }
    `}`;

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

const activeNavItemStyle = {
    color: 'var(--button-bg)',
    boxShadow: 'inset 0px -2px 0px 0px var(--button-bg)',
};

export default Playbook;
