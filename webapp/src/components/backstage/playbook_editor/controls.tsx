// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {HTMLAttributes, PropsWithChildren, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import Icon from '@mdi/react';
import {mdiClipboardPlayOutline} from '@mdi/js';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Client4} from 'mattermost-redux/client';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from 'mattermost-redux/types/teams';
import {GlobalState} from 'mattermost-redux/types/store';
import {getCurrentUserId, getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {FormattedMessage, useIntl} from 'react-intl';

import {createGlobalState} from 'react-use';

import {pluginUrl, navigateToPluginUrl, navigateToUrl} from 'src/browser_routing';
import {useHasPlaybookPermission} from 'src/hooks';
import {useToasts} from '../toast_banner';

import {
    duplicatePlaybook as clientDuplicatePlaybook,
    autoFollowPlaybook,
    autoUnfollowPlaybook,
    telemetryEventForPlaybook,
    playbookExportProps,
    archivePlaybook,
    createPlaybookRun,
    clientFetchPlaybookFollowers,
} from 'src/client';
import {OVERLAY_DELAY} from 'src/constants';
import {PlaybookWithChecklist} from 'src/types/playbook';
import {PrimaryButton} from 'src/components/assets/buttons';
import {RegularHeading, SemiBoldHeading} from 'src/styles/headings';
import CheckboxInput from '../runs_list/checkbox_input';
import {SecondaryButtonLargerRight} from '../playbook_runs/shared';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';

import {displayEditPlaybookAccessModal} from 'src/actions';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import DotMenu, {DropdownMenuItem, DropdownMenuItemStyled} from 'src/components/dot_menu';
import useConfirmPlaybookArchiveModal from '../archive_playbook_modal';

type ControlProps = {playbook: PlaybookWithChecklist;};

type StyledProps = {className?: string;};

const StyledLink = styled(Link)`
    a&& {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-weight: 600;
        font-size: 14px;
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        border-radius: 4px;
        height: 36px;
        padding: 0 8px;


        &:hover,
        &:focus {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
            text-decoration: none;
        }
    }

    span {
        padding-right: 8px;
    }

    i {
        font-size: 18px;
    }
`;

export const Back = styled((props: StyledProps) => {
    return (
        <StyledLink
            {...props}
            to={pluginUrl('/playbooks')}
        >
            <i className='icon-arrow-left'/>
            <FormattedMessage defaultMessage='Back'/>
        </StyledLink>
    );
})`

`;

export const Members = ({playbook: {id, members}}: ControlProps) => {
    const dispatch = useDispatch();
    return (
        <IconButton onClick={() => dispatch(displayEditPlaybookAccessModal(id))}>
            <i className={'icon icon-account-multiple-outline'}/>
            {members.length}
        </IconButton>
    );
};

export const Share = ({playbook: {id, members}}: ControlProps) => {
    const dispatch = useDispatch();
    return (
        <IconButton onClick={() => dispatch(displayEditPlaybookAccessModal(id))}>
            <i className={'icon icon-account-multiple-outline'}/>
        </IconButton>
    );
};

export const ArchivedLabel = ({playbook: {delete_at}}: ControlProps) => {
    const archived = delete_at !== 0;
    if (!archived) {
        return null;
    }
    return (
        <StatusBadge
            data-testid={'archived-badge'}
            status={BadgeType.Archived}
        />
    );
};

const changeFollowing = async (playbookId: string, userId: string, following: boolean) => {
    if (!playbookId || !userId) {
        return null;
    }

    try {
        if (following) {
            await autoFollowPlaybook(playbookId, userId);
        } else {
            await autoUnfollowPlaybook(playbookId, userId);
        }
        return following;
    } catch {
        return null;
    }
};

const useFollowerIds = createGlobalState<string[] | null>(null);
const useIsFollowing = createGlobalState(false);

export const useEditorFollowersMeta = (playbookId: string) => {
    const [followerIds, setFollowerIds] = useFollowerIds();
    const [isFollowing, setIsFollowing] = useIsFollowing();
    const currentUserId = useSelector(getCurrentUserId);

    const refresh = async () => {
        if (!playbookId || !currentUserId) {
            return;
        }
        const followers = await clientFetchPlaybookFollowers(playbookId);
        setFollowerIds(followers);
        setIsFollowing(followers.includes(currentUserId));
    };

    useEffect(() => {
        if (followerIds === null) {
            setFollowerIds([]);
            refresh();
        }
    }, [followerIds]);

    const setFollowing = async (following: boolean) => {
        setIsFollowing(following);
        await changeFollowing(playbookId, currentUserId, following);
        refresh();
    };

    return {followerIds: followerIds ?? [], isFollowing, setFollowing};
};

export const AutoFollowToggle = ({playbook}: ControlProps) => {
    const {formatMessage} = useIntl();
    const {isFollowing, setFollowing} = useEditorFollowersMeta(playbook.id);

    const archived = playbook.delete_at !== 0;

    let toolTipText = formatMessage({defaultMessage: 'Select this to automatically receive updates when this playbook is run.'});
    if (isFollowing) {
        toolTipText = formatMessage({defaultMessage: 'You automatically receive updates when this playbook is run.'});
    }

    const tooltip = (
        <Tooltip id={`auto-follow-tooltip-${isFollowing}`}>
            {toolTipText}
        </Tooltip>
    );

    return (
        <SecondaryButtonLargerRightStyled
            checked={isFollowing}
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
                        checked={isFollowing}
                        disabled={archived}
                        onChange={setFollowing}
                    />
                </div>
            </OverlayTrigger>
        </SecondaryButtonLargerRightStyled>
    );
};

const LEARN_PLAYBOOKS_TITLE = 'Learn how to use playbooks';
const playbookIsTutorialPlaybook = (playbook: PlaybookWithChecklist) => playbook?.title === LEARN_PLAYBOOKS_TITLE;

export const RunPlaybook = ({playbook}: ControlProps) => {
    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const currentUser = useSelector(getCurrentUser);
    const isTutorialPlaybook = playbookIsTutorialPlaybook(playbook);
    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);
    const enableRunPlaybook = playbook.delete_at === 0 && hasPermissionToRunPlaybook;

    const runPlaybook = async () => {
        if (playbook && isTutorialPlaybook) {
            const playbookRun = await createPlaybookRun(playbook.id, currentUser.id, playbook.team_id, `${currentUser.username}'s onboarding run`, playbook.description);
            const channel = await Client4.getChannel(playbookRun.channel_id);

            navigateToUrl({
                pathname: `/${team.name}/channels/${channel.name}`,
                search: '?forceRHSOpen&openTakeATourDialog',
            });
            return;
        }
        if (playbook?.id) {
            telemetryEventForPlaybook(playbook.id, 'playbook_dashboard_run_clicked');
            navigateToUrl(`/${team.name || ''}/_playbooks/${playbook?.id || ''}/run`);
        }
    };

    return (
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
    );
};

export const TitleMenu = styled(({playbook, children, className}: PropsWithChildren<ControlProps> & {className?: string;}) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [exportHref, exportFilename] = playbookExportProps(playbook);
    const [modal, openDeletePlaybookModal] = useConfirmPlaybookArchiveModal(() => {
        if (playbook) {
            archivePlaybook(playbook.id);
            navigateToPluginUrl('/playbooks');
        }
    });
    const {add: addToast} = useToasts();

    const archived = playbook.delete_at !== 0;

    return (
        <DotMenu
            dotMenuButton={TitleButton}
            className={className}
            left={true}
            icon={
                <>
                    {children}
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
            {!archived && (
                <DropdownMenuItem
                    onClick={() => openDeletePlaybookModal(playbook)}
                >
                    <RedText>
                        <FormattedMessage defaultMessage='Archive playbook'/>
                    </RedText>
                </DropdownMenuItem>
            )}
            {modal}
        </DotMenu>
    );
})`

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

const SecondaryButtonLargerRightStyled = styled(SecondaryButtonLargerRight) <{checked: boolean}>`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover:enabled {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    ${({checked}) => checked && css`
    border: 1px solid var(--button-bg);
        color: var(--button-bg);

        &:hover:enabled {
            background-color: rgba(var(--button-bg-rgb), 0.12);
        }
    `}
`;

const RightMarginedIcon = styled(Icon)`
    margin-right: 0.5rem;
`;

const IconButton = styled.div`
    display: inline-block;
    font-size: 14px;
    line-height: 24px;
    font-weight: 600;
    border-radius: 4px;
    padding: 0px 8px;
    margin: 0;
    margin-right: 4px;
    color: rgba(var(--center-channel-color-rgb),0.56);
    height: 24px;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

const TitleButton = styled.div`
    margin-left: 20px;
    padding-left: 16px;
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
