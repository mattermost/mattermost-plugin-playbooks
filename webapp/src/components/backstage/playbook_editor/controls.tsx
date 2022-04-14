// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {HTMLAttributes, useEffect, useState} from 'react';
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

import classNames from 'classnames';

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

type ControlProps = {
    playbook: PlaybookWithChecklist;
};

const ArrowLeft = styled.i.attrs({className: 'icon-arrow-left'})`

`;

export const Back = () => {
    return (
        <Link to={pluginUrl('/playbooks')}>
            <ArrowLeft/>
            <FormattedMessage defaultMessage='Back'/>
        </Link>
    );
};

export const Members = ({playbook: {id, members}}: ControlProps) => {
    const dispatch = useDispatch();
    return (
        <MembersIcon onClick={() => dispatch(displayEditPlaybookAccessModal(id))}>
            <i className={'icon icon-account-multiple-outline'}/>
            {members.length}
        </MembersIcon>
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

export const AutoFollowToggle = ({playbook}: ControlProps) => {
    const {formatMessage} = useIntl();
    const {
        isFollowing,
        setIsFollowing,
    } = useFollowersMeta(playbook.id);
    const currentUserId = useSelector(getCurrentUserId);

    const changeFollowing = (following: boolean) => {
        if (playbook.id && following !== isFollowing) {
            if (following) {
                autoFollowPlaybook(playbook.id, currentUserId);
            } else {
                autoUnfollowPlaybook(playbook.id, currentUserId);
            }
            setIsFollowing(following);
        }
    };

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
                        onChange={changeFollowing}
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

export const TitleMenu = ({playbook}: ControlProps) => {
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
            left={true}
            icon={
                <>
                    <i className={classNames('icon', playbook.public ? 'icon-globe' : 'icon-lock-outline')}/>
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
};

const Title = styled.div`
    ${RegularHeading}
    font-size: 20px;
    line-height: 28px;
    height: 28px;
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

const TopContainer = styled.div`
    position: sticky;
    z-index: 2;
    top: 0;
    background: var(--center-channel-bg);
    width: 100%;
    height: 100%;
    box-shadow: inset 0 -1px 0 0 rgba(var(--center-channel-color-rgb), 0.08);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    padding: 0 32px;
    height: 100%;
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

const RightMarginedIcon = styled(Icon)`
    margin-right: 0.5rem;
`;

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
