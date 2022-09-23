// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';
<<<<<<< HEAD
import {StarIcon, StarOutlineIcon, LightningBoltOutlineIcon, LinkVariantIcon, ArrowDownIcon, FlagOutlineIcon, CloseIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';
=======
>>>>>>> master

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {showRunActionsModal} from 'src/actions';
<<<<<<< HEAD
import {exportChannelUrl, getSiteUrl, leaveRun} from 'src/client';
import {PlaybookRun, playbookRunIsActive, playbookStatusUpdateEnabled} from 'src/types/playbook_run';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
=======
import {navigateToUrl, pluginUrl} from 'src/browser_routing';
import {PlaybookRun} from 'src/types/playbook_run';
import DotMenu from 'src/components/dot_menu';
>>>>>>> master
import {SemiBoldHeading} from 'src/styles/headings';
import {useRunMembership} from 'src/graphql/hooks';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import ConfirmModal from 'src/components/widgets/confirmation_modal';

<<<<<<< HEAD
import {useOnFinishRun} from './finish_run';
import {useOnRestoreRun} from './restore_run';
import {useEnableOrDisableRunStatusUpdate} from './enable_disable_run_status_update';
=======
import {CopyRunLinkMenuItem, ExportChannelLogsMenuItem, FavoriteRunMenuItem, FinishRunMenuItem, LeaveRunMenuItem, RestoreRunMenuItem, RunActionsMenuItem} from './controls';
>>>>>>> master

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    hasPermanentViewerAccess: boolean;
    toggleFavorite: () => void;
}

export const ContextMenu = ({playbookRun, hasPermanentViewerAccess, role, isFavoriteRun, isFollowing, toggleFavorite}: Props) => {
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(hasPermanentViewerAccess, playbookRun.id, playbookRun.owner_user_id, isFollowing);
    const [showModal, setShowModal] = useState(false);

<<<<<<< HEAD
    const onExportClick = () => {
        if (!allowChannelExport) {
            setShowModal(true);
            return;
        }

        window.location.href = exportChannelUrl(playbookRun.channel_id);
    };

    const onFinishRun = useOnFinishRun(playbookRun);
    const onRestoreRun = useOnRestoreRun(playbookRun);
    const runStatusUpdate = useEnableOrDisableRunStatusUpdate(playbookRun);

=======
>>>>>>> master
    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                placement='bottom-start'
                icon={
                    <>
                        <Title>{playbookRun.name}</Title>
                        <i
                            className={'icon icon-chevron-down'}
                            data-testid='runDropdown'
                        />
                    </>
                }
            >

<<<<<<< HEAD
                <StyledDropdownMenuItem
                    onClick={() => {
                        copyToClipboard(getSiteUrl() + '/playbooks/runs/' + playbookRun?.id);
                        addToast(formatMessage({defaultMessage: 'Copied!'}));
                    }}
                >
                    <LinkVariantIcon size={18}/>
                    <FormattedMessage defaultMessage='Copy link'/>
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    onClick={() => dispatch(showRunActionsModal())}
                >
                    <LightningBoltOutlineIcon size={18}/>
                    <FormattedMessage defaultMessage='Run actions'/>
                </StyledDropdownMenuItem>
                <StyledDropdownMenuItem
                    disabled={!exportAvailable}
                    disabledAltText={formatMessage({defaultMessage: 'Install and enable the Channel Export plugin to support exporting the channel'})}
                    onClick={onExportClick}
                >
                    <ArrowDownIcon size={18}/>
                    <FormattedMessage defaultMessage='Export channel log'/>
                </StyledDropdownMenuItem>
                {
                    !playbookStatusUpdateEnabled(playbookRun) && role === Role.Participant &&
                        <>
                            <Separator/>
                            <StyledDropdownMenuItem
                                onClick={() => runStatusUpdate('enable')}
                                className='restartRun'
                            >
                                <ClockOutlineIcon size={18}/>
                                <FormattedMessage
                                    defaultMessage='Enable status update'
                                />
                            </StyledDropdownMenuItem>
                        </>
                }
                {
                    playbookStatusUpdateEnabled(playbookRun) && role === Role.Participant &&
                        <>
                            <Separator/>
                            <StyledDropdownMenuItem
                                onClick={() => runStatusUpdate('disable')}
                                className='restartRun'
                            >
                                <ClockOutlineIcon size={18}/>
                                <FormattedMessage
                                    defaultMessage='Disable status update'
                                />
                            </StyledDropdownMenuItem>
                        </>
                }
                {
                    playbookRunIsActive(playbookRun) && role === Role.Participant &&
                        <>
                            <Separator/>
                            <StyledDropdownMenuItem
                                onClick={onFinishRun}
                            >
                                <FlagOutlineIcon size={18}/>
                                <FormattedMessage defaultMessage='Finish run'/>
                            </StyledDropdownMenuItem>
                        </>
                }
                {
                    !playbookRunIsActive(playbookRun) && role === Role.Participant &&
                        <>
                            <Separator/>
                            <StyledDropdownMenuItem
                                onClick={onRestoreRun}
                                className='restartRun'
                            >
                                <FlagOutlineIcon size={18}/>
                                <FormattedMessage
                                    defaultMessage='Restart run'
                                />
                            </StyledDropdownMenuItem>
                        </>
                }
                {
                    role === Role.Participant &&
                    <>
                        <Separator/>
                        <StyledDropdownMenuItemRed onClick={showLeaveRunConfirm}>
                            <CloseIcon size={18}/>
                            <FormattedMessage
                                defaultMessage='Leave {isFollowing, select, true { and unfollow } other {}}run'
                                values={{isFollowing}}
                            />
                        </StyledDropdownMenuItemRed>
                    </>
                }
=======
                <FavoriteRunMenuItem
                    isFavoriteRun={isFavoriteRun}
                    toggleFavorite={toggleFavorite}
                />
                <CopyRunLinkMenuItem
                    playbookRunId={playbookRun.id}
                />
                <Separator/>
                <RunActionsMenuItem
                    showRunActionsModal={showRunActionsModal}
                />
                <ExportChannelLogsMenuItem
                    channelId={playbookRun.channel_id}
                    setShowModal={setShowModal}
                />
                <FinishRunMenuItem
                    playbookRun={playbookRun}
                    role={role}
                />
                <RestoreRunMenuItem
                    playbookRun={playbookRun}
                    role={role}
                />
                <LeaveRunMenuItem
                    isFollowing={isFollowing}
                    role={role}
                    showLeaveRunConfirm={showLeaveRunConfirm}
                />
>>>>>>> master
            </DotMenu>
            <UpgradeModal
                messageType={AdminNotificationType.EXPORT_CHANNEL}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
            {leaveRunConfirmModal}
        </>
    );
};

export const useLeaveRun = (hasPermanentViewerAccess: boolean, playbookRunId: string, ownerUserId: string, isFollowing: boolean) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const addToast = useToaster().add;
    const [showLeaveRunConfirm, setLeaveRunConfirm] = useState(false);
    const {removeFromRun} = useRunMembership(playbookRunId, [currentUserId]);
    const refreshLHS = useLHSRefresh();

    const onLeaveRun = async () => {
        removeFromRun()
            .then(() => {
                refreshLHS();
                addToast(formatMessage({defaultMessage: "You've left the run."}), ToastType.Success);

                const sameRunRDP = window.location.href.includes('runs/' + playbookRunId);

                if (!hasPermanentViewerAccess && sameRunRDP) {
                    navigateToUrl(pluginUrl(''));
                }
            }).catch(() => addToast(formatMessage({defaultMessage: "It wasn't possible to leave the run."}), ToastType.Failure));
    };
    const leaveRunConfirmModal = (
        <ConfirmModal
            show={showLeaveRunConfirm}
            title={formatMessage({defaultMessage: 'Confirm leave{isFollowing, select, true { and unfollow} other {}}'}, {isFollowing})}
            message={formatMessage({defaultMessage: 'When you leave{isFollowing, select, true { and unfollow a run} other { a run}}, it\'s removed from the left-hand sidebar. You can find it again by viewing all runs.'}, {isFollowing})}
            confirmButtonText={formatMessage({defaultMessage: 'Leave and unfollow'})}
            onConfirm={() => {
                onLeaveRun();
                setLeaveRunConfirm(false);
            }}
            onCancel={() => setLeaveRunConfirm(false)}
            stopPropagationOnClick={true}
        />
    );

    return {
        leaveRunConfirmModal,
        showLeaveRunConfirm: () => {
            if (currentUserId === ownerUserId) {
                addToast(formatMessage({defaultMessage: 'Assign a new owner before you leave the run.'}), ToastType.Failure);
                return;
            }
            setLeaveRunConfirm(true);
        },
    };
};

const Title = styled.h1`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 16px;
    line-height: 24px;
    margin: 0;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
`;

export const TitleButton = styled.div<{isActive: boolean}>`
    padding: 2px 2px 2px 6px;
    display: inline-flex;
    border-radius: 4px;
    color: ${({isActive}) => (isActive ? 'var(--button-bg)' : 'var(--center-channel-color)')};
    background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'auto')};

    min-width: 0;

    &:hover {
        background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;
