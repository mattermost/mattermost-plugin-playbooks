// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';

import {showRunActionsModal} from 'src/actions';
import {leaveRun} from 'src/client';
import {PlaybookRun} from 'src/types/playbook_run';
import DotMenu from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {navigateToUrl, pluginUrl} from 'src/browser_routing';
import {useLHSRefresh} from '../../lhs_navigation';

import {CopyRunLinkMenuItem, ExportChannelLogsMenuItem, FavoriteRunMenuItem, FinishRunMenuItem, LeaveRunMenuItem, RestoreRunMenuItem, RunActionsMenuItem} from './controls';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    toggleFavorite: () => void;
}

export const ContextMenu = ({playbookRun, role, isFavoriteRun, isFollowing, toggleFavorite}: Props) => {
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(playbookRun.id, playbookRun.owner_user_id, isFollowing);
    const [showModal, setShowModal] = useState(false);

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

export const useLeaveRun = (playbookRunId: string, ownerUserId: string, isFollowing: boolean) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const addToast = useToaster().add;
    const [showLeaveRunConfirm, setLeaveRunConfirm] = useState(false);
    const refreshLHS = useLHSRefresh();

    const onLeaveRun = async () => {
        const response = await leaveRun(playbookRunId);
        if (response?.error) {
            addToast(formatMessage({defaultMessage: "It wasn't possible to leave the run."}), ToastType.Failure);
        } else {
            refreshLHS();
            addToast(formatMessage({defaultMessage: "You've left the run."}), ToastType.Success);
            if (!response.has_view_permission) {
                navigateToUrl(pluginUrl(''));
            }
        }
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
