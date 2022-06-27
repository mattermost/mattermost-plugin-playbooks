// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';
import React, {PropsWithChildren, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import Icon from '@mdi/react';
import {DateTime} from 'luxon';
import {mdiClipboardPlayOutline} from '@mdi/js';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Client4} from 'mattermost-redux/client';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {Team} from '@mattermost/types/teams';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentUserId, getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {FormattedMessage, FormattedNumber, useIntl} from 'react-intl';

import {createGlobalState} from 'react-use';

import {pluginUrl, navigateToPluginUrl, navigateToUrl} from 'src/browser_routing';
import {PlaybookPermissionsMember, useHasPlaybookPermission, useHasTeamPermission} from 'src/hooks';
import {useToasts} from '../toast_banner';
import {ScheduledRun} from 'src/types/playbook_run';
import {Frequency, frequencyText} from 'src/components/schedule_run_dialog';

import {
    duplicatePlaybook as clientDuplicatePlaybook,
    autoFollowPlaybook,
    autoUnfollowPlaybook,
    telemetryEventForPlaybook,
    playbookExportProps,
    archivePlaybook,
    createPlaybookRun,
    clientFetchPlaybookFollowers,
    getSiteUrl,
    cancelScheduledRun,
} from 'src/client';
import {OVERLAY_DELAY} from 'src/constants';
import {ButtonIcon, PrimaryButton, SecondaryButton, TertiaryButton} from 'src/components/assets/buttons';
import CheckboxInput from '../runs_list/checkbox_input';
import StatusBadge, {BadgeType} from 'src/components/backstage/status_badge';

import {displayEditPlaybookAccessModal, displayScheduleRunDialog} from 'src/actions';
import {PlaybookPermissionGeneral} from 'src/types/permissions';
import DotMenu, {DropdownMenuItem, DropdownMenuItemStyled} from 'src/components/dot_menu';
import useConfirmPlaybookArchiveModal from '../archive_playbook_modal';
import CopyLink from 'src/components/widgets/copy_link';
import useConfirmPlaybookRestoreModal from '../restore_playbook_modal';

import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';
import TooltipWidget from 'src/components/widgets/tooltip';

type ControlProps = {playbook: {
    id: string,
    public: boolean,
    default_playbook_member_role: string,
    title: string,
    delete_at: number,
    team_id: string,
    description: string,
    members: PlaybookPermissionsMember[],
}};

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

export const Members = (props: {playbookId: string, numMembers: number}) => {
    const dispatch = useDispatch();
    return (
        <ButtonIconStyled onClick={() => dispatch(displayEditPlaybookAccessModal(props.playbookId))}>
            <i className={'icon icon-account-multiple-outline'}/>
            <FormattedNumber value={props.numMembers}/>
        </ButtonIconStyled>
    );
};

export const Share = ({playbook: {id}}: ControlProps) => {
    const dispatch = useDispatch();
    return (
        <TertiaryButtonLarger onClick={() => dispatch(displayEditPlaybookAccessModal(id))}>
            <i className={'icon icon-lock-outline'}/>
            <FormattedMessage defaultMessage='Share'/>
        </TertiaryButtonLarger>
    );
};

export const CopyPlaybook = ({playbook: {title, id}}: ControlProps) => {
    return (
        <CopyLink
            id='copy-playbook-link-tooltip'
            to={getSiteUrl() + '/playbooks/playbooks/' + id}
            name={title}
            area-hidden={true}
        />
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
        <SecondaryButtonLargerCheckbox
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
        </SecondaryButtonLargerCheckbox>
    );
};

const LEARN_PLAYBOOKS_TITLE = 'Learn how to use playbooks';
const playbookIsTutorialPlaybook = (playbookTitle?: string) => playbookTitle === LEARN_PLAYBOOKS_TITLE;

export const RunPlaybook = ({playbook}: ControlProps) => {
    const {formatMessage} = useIntl();
    const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || ''));
    const currentUser = useSelector(getCurrentUser);
    const isTutorialPlaybook = playbookIsTutorialPlaybook(playbook.title);
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
        <MainRunButton
            onClick={runPlaybook}
            disabled={!enableRunPlaybook}
            title={enableRunPlaybook ? formatMessage({defaultMessage: 'Run Playbook'}) : formatMessage({defaultMessage: 'You do not have permissions'})}
            data-testid='run-playbook'
        >
            <Icon
                path={mdiClipboardPlayOutline}
                size={1.25}
            />
            {isTutorialPlaybook ? (
                <FormattedMessage defaultMessage='Start a test run'/>
            ) : (
                <FormattedMessage defaultMessage='Run'/>
            )}
        </MainRunButton>
    );
};

interface ScheduleRunProps {
    scheduledRun: ScheduledRun | null;
    setScheduledRun: (newRun: ScheduledRun | null) => void;
}

export const ScheduleRun = ({playbook, scheduledRun, setScheduledRun}: ControlProps & ScheduleRunProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    /* const team = useSelector<GlobalState, Team>((state) => getTeam(state, playbook?.team_id || '')); */
    /* const currentUser = useSelector(getCurrentUser); */
    const isTutorialPlaybook = playbookIsTutorialPlaybook(playbook.title);
    const hasPermissionToRunPlaybook = useHasPlaybookPermission(PlaybookPermissionGeneral.RunCreate, playbook);
    const enableRunPlaybook = playbook.delete_at === 0 && hasPermissionToRunPlaybook;

    if (isTutorialPlaybook) {
        return null;
    }

    const onClickHandler = async () => {
        dispatch(displayScheduleRunDialog({
            scheduledRun,
            setScheduledRun,
            playbook,
        }));
    };

    if (!enableRunPlaybook) {
        return null;
    }

    return (
        <TooltipWidget
            id={'playbook_editor_schedule_run'}
            content={formatMessage({defaultMessage: 'Schedule a run'})}
            placement={'bottom'}
        >
            <ScheduleRunButton
                onClick={onClickHandler}
                disabled={!enableRunPlaybook}
                data-testid='run-playbook'
            >
                <ScheduleRunButtonIcon className={'icon-12 icon-chevron-down'}/>
            </ScheduleRunButton>
        </TooltipWidget>
    );
};

const ScheduleRunButtonIcon = styled.i`
    color: var(--button-color);
`;

export const RunSchedulePlaybook = (props: ControlProps & ScheduleRunProps) => {
    return (
        <RunScheduleButton>
            <RunPlaybook playbook={props.playbook}/>
            <ScheduleRun {...props}/>
        </RunScheduleButton>
    );
};

const RunScheduleButton = styled.div`
    display: flex;
    flex-direction: row;
`;

export const ScheduledChip = ({playbook, scheduledRun, setScheduledRun}: ControlProps & ScheduleRunProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [hovered, setHovered] = useState(false);

    const onClickHandler = async () => {
        dispatch(displayScheduleRunDialog({
            scheduledRun,
            setScheduledRun,
            playbook,
        }));
    };

    const freq = scheduledRun?.frequency as Frequency || Frequency.Never;
    const jsDate = scheduledRun?.first_run.toJSDate() || DateTime.now().toJSDate();

    let content = formatMessage(
        {defaultMessage: 'Scheduled to run on {jsDate, date} at {jsDate, time, short}'},
        {jsDate},
    );
    if (scheduledRun?.frequency !== '' && scheduledRun?.frequency !== Frequency.Never) {
        content = formatMessage(
            {defaultMessage: 'Scheduled to run {freqText} at {jsDate, time, short}'},
            {freqText: frequencyText(freq, jsDate, formatMessage), jsDate},
        );
    }

    return (
        <ScheduledChipContainer
            onClick={onClickHandler}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            visible={Boolean(scheduledRun)}
        >
            <ScheduledIcon className={'icon-10 icon-calendar-check-outline'}/>
            <ScheduledText>
                {content}
            </ScheduledText>
            <RemoveScheduledIcon
                visible={hovered}
                className={'icon-12 icon-trash-can-outline'}
                onClick={(e) => {
                    e.stopPropagation();

                    dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
                        show: true,
                        title: formatMessage({defaultMessage: 'Delete scheduled runs?'}),
                        message: formatMessage({defaultMessage: 'Are you sure you want to delete <strong>all</strong> scheduled runs? This can\'t be undone.'}, {strong: chunk => <strong>{chunk}</strong>}),
                        confirmButtonText: formatMessage({defaultMessage: 'Delete'}),
                        cancelButtonText: formatMessage({defaultMessage: 'Cancel'}),
                        isConfirmDestructive: true,
                        onConfirm: () => cancelScheduledRun(playbook.id).then(() => setScheduledRun(null)),
                        // eslint-disable-next-line @typescript-eslint/no-empty-function
                        onCancel: () => {},
                    })));
                }}
            />
        </ScheduledChipContainer>
    );
};

const ScheduledChipContainer = styled.div<{visible: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 4px 6px 4px 4px;
    gap: 6px;
    margin-left: 16px;
    margin-bottom: 6px;
    max-width: max-content;
    cursor: pointer;

    height: 24px;

    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;

    margin-top: ${({visible}) => (visible ? '0' : '-30px')};
    opacity: ${({visible}) => (visible ? '100%' : '0')};

    transition: margin .3s, opacity ${({visible}) => (visible ? '.5s' : '.2s')};
`;

const ScheduledIcon = styled.i`
    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;
    background: rgba(var(--center-channel-color-rgb), 0.32);
    color: var(--button-color);
    padding: 3px;
    width: 16px;
    height: 16px;
`;

const RemoveScheduledIcon = styled.i<{visible: boolean}>`
    color: var(--dnd-indicator);

    transition: margin .3s, opacity ${({visible}) => (visible ? '.5s' : '.2s')};

    margin-left: ${({visible}) => (visible ? '-4px' : '-18px')};
    opacity: ${({visible}) => (visible ? '100%' : '0')};
    display: flex;
    align-items: center;
    justify-content: center;

    width: 18px;
    height: 18px;
    border-radius: 50%;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const ScheduledText = styled.div`
    font-weight: 600;
    font-size: 12px;
    color: var(--center-channel-color);
`;

type TitleMenuProps = {
    className?: string;
    editTitle: () => void;
    refetch: () => void;
} & PropsWithChildren<ControlProps>;
const TitleMenuImpl = ({playbook, children, className, editTitle, refetch}: TitleMenuProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [exportHref, exportFilename] = playbookExportProps(playbook);
    const [confirmArchiveModal, openDeletePlaybookModal] = useConfirmPlaybookArchiveModal(() => {
        if (playbook) {
            archivePlaybook(playbook.id);
            navigateToPluginUrl('/playbooks');
        }
    });
    const [confirmRestoreModal, openConfirmRestoreModal] = useConfirmPlaybookRestoreModal();

    const {add: addToast} = useToasts();

    const archived = playbook.delete_at !== 0;

    const permissionForDuplicate = useHasTeamPermission(playbook.team_id, 'playbook_public_create');

    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                className={className}
                placement='bottom-end'
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
                    onClick={editTitle}
                    disabled={archived}
                    disabledAltText={formatMessage({defaultMessage: 'This archived playbook cannot be renamed.'})}
                >
                    <FormattedMessage defaultMessage='Rename'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={async () => {
                        const newID = await clientDuplicatePlaybook(playbook.id);
                        navigateToPluginUrl(`/playbooks/${newID}/outline`);
                        addToast(formatMessage({defaultMessage: 'Successfully duplicated playbook'}));
                        telemetryEventForPlaybook(playbook.id, 'playbook_duplicate_clicked_in_playbook');
                    }}
                    disabled={!permissionForDuplicate}
                    disabledAltText={formatMessage({defaultMessage: 'Duplicate is disabled for this team.'})}
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
                {archived ? (
                    <DropdownMenuItem
                        onClick={() => openConfirmRestoreModal(playbook, () => refetch())}
                    >
                        <FormattedMessage defaultMessage='Restore playbook'/>
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        onClick={() => openDeletePlaybookModal(playbook)}
                    >
                        <RedText>
                            <FormattedMessage defaultMessage='Archive playbook'/>
                        </RedText>
                    </DropdownMenuItem>
                )}
            </DotMenu>
            {confirmArchiveModal}
            {confirmRestoreModal}
        </>
    );
};

export const TitleMenu = styled(TitleMenuImpl)`

`;

const buttonCommon = css`
    padding: 0 16px;
    height: 36px;
    gap: 8px;

    i::before {
        margin-left: 0;
        margin-right: 0;
        font-size: 1.05em;
    }
`;

const PrimaryButtonLarger = styled(PrimaryButton)`
    ${buttonCommon};
`;

const MainRunButton = styled(PrimaryButtonLarger)`
    border-radius: 4px 0 0 4px;
`;

const ScheduleRunButton = styled(PrimaryButtonLarger)`
    border-radius: 0 4px 4px 0;
    padding: 9px;
    border-left: 1px solid rgba(var(--center-channel-bg-rgb), 0.32);
`;

const SecondaryButtonLarger = styled(SecondaryButton)`
    ${buttonCommon};
`;

const TertiaryButtonLarger = styled(TertiaryButton)`
    ${buttonCommon};
`;

const CheckboxInputStyled = styled(CheckboxInput)`
    padding: 8px 16px;
    font-size: 14px;
    height: 36px;

    &:hover {
        background-color: transparent;
    }
`;

const SecondaryButtonLargerCheckbox = styled(SecondaryButtonLarger) <{checked: boolean}>`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.24);
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding: 0;

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

const ButtonIconStyled = styled(ButtonIcon)`
    display: inline-flex;
    align-items: center;
    font-size: 14px;
    line-height: 24px;
    font-weight: 600;
    border-radius: 4px;
    padding: 0px 8px;
    margin: 0;
    color: rgba(var(--center-channel-color-rgb),0.56);
    height: 36px;
    width: auto;
`;

export const TitleButton = styled.div`
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
