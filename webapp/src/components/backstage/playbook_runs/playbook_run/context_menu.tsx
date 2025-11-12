// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {showRunActionsModal} from 'src/actions';
import {navigateToUrl, pluginUrl} from 'src/browser_routing';
import {PlaybookRun} from 'src/types/playbook_run';
import DotMenu, {TitleButton} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import {useManageRunMembership} from 'src/graphql/hooks';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {ExportOptionsModal} from 'src/components/backstage/playbook_runs/run_report';

import {
    CopyRunLinkMenuItem,
    ExportChannelLogsMenuItem,
    ExportRunReportMenuItem,
    FavoriteRunMenuItem,
    FinishRunMenuItem,
    LeaveRunMenuItem,
    RenameRunItem,
    RestoreRunMenuItem,
    RunActionsMenuItem,
    ToggleRunStatusUpdateMenuItem,
} from './controls';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    hasPermanentViewerAccess: boolean;
    toggleFavorite: () => void;
    onRenameClick: () => void;
}

export const ContextMenu = ({playbookRun, hasPermanentViewerAccess, role, isFavoriteRun, isFollowing, toggleFavorite, onRenameClick}: Props) => {
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(hasPermanentViewerAccess, playbookRun.id, playbookRun.owner_user_id, isFollowing);
    const [showModal, setShowModal] = useState(false);
    const {showExportReportModal, exportReportModal} = useExportRunReport(playbookRun.id);

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
                <RenameRunItem
                    playbookRun={playbookRun}
                    role={role}
                    onClick={onRenameClick}
                />
                <Separator/>
                <RunActionsMenuItem
                    showRunActionsModal={showRunActionsModal}
                />
                <ExportChannelLogsMenuItem
                    channelId={playbookRun.channel_id}
                    setShowModal={setShowModal}
                />
                <ExportRunReportMenuItem
                    onClick={showExportReportModal}
                />
                <FinishRunMenuItem
                    playbookRun={playbookRun}
                    role={role}
                />
                <RestoreRunMenuItem
                    playbookRun={playbookRun}
                    role={role}
                />
                <ToggleRunStatusUpdateMenuItem
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
            {exportReportModal}
        </>
    );
};

export const useLeaveRun = (hasPermanentViewerAccess: boolean, playbookRunId: string, ownerUserId: string, isFollowing: boolean) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const addToast = useToaster().add;
    const [showLeaveRunConfirm, setLeaveRunConfirm] = useState(false);
    const {removeFromRun} = useManageRunMembership(playbookRunId);
    const refreshLHS = useLHSRefresh();

    const onLeaveRun = async () => {
        removeFromRun([currentUserId])
            .then(() => {
                refreshLHS();
                addToast({
                    content: formatMessage({defaultMessage: "You've left the run."}),
                    toastStyle: ToastStyle.Success,
                });

                const sameRunRDP = window.location.href.includes('runs/' + playbookRunId);
                if (!hasPermanentViewerAccess && sameRunRDP) {
                    navigateToUrl(pluginUrl(''));
                }
            }).catch(() => addToast({
                content: formatMessage({defaultMessage: "It wasn't possible to leave the run."}),
                toastStyle: ToastStyle.Failure,
            }));
    };
    const leaveRunConfirmModal = (
        <ConfirmModal
            show={showLeaveRunConfirm}
            title={formatMessage({defaultMessage: 'Confirm leave{isFollowing, select, true { and unfollow} other {}}'}, {isFollowing})}
            message={formatMessage({defaultMessage: 'When you leave{isFollowing, select, true { and unfollow a run} other { a run}}, it\'s removed from the left-hand sidebar. You can find it again by viewing all runs.'}, {isFollowing})}
            confirmButtonText={isFollowing ? formatMessage({defaultMessage: 'Leave and unfollow'}) : formatMessage({defaultMessage: 'Leave'})}
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
                addToast({
                    content: formatMessage({defaultMessage: 'Assign a new owner before you leave the run.'}),
                    toastStyle: ToastStyle.Failure,
                });
                return;
            }
            setLeaveRunConfirm(true);
        },
    };
};

export const useExportRunReport = (playbookRunId: string) => {
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportData, setExportData] = useState<any>(null);

    const showExportReportModal = async () => {
        setShowExportModal(true);

        try {
            // Import client here to avoid circular dependencies
            const {fetchPlaybookRunExportData} = await import('src/client');
            const data = await fetchPlaybookRunExportData(playbookRunId);
            setExportData(data);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching export data:', error);
            setExportData(null);
        }
    };

    const hideExportModal = () => {
        setShowExportModal(false);
        setExportData(null);
    };

    const exportReportModal = (
        <ExportOptionsModal
            show={showExportModal}
            onHide={hideExportModal}
            data={exportData}
        />
    );

    return {
        showExportReportModal,
        exportReportModal,
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

