// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {showRunActionsModal} from 'src/actions';
import {exportChannelUrl, getSiteUrl, leaveRun} from 'src/client';
import {PlaybookRun, playbookRunIsActive} from 'src/types/playbook_run';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import {copyToClipboard} from 'src/utils';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
import {useAllowChannelExport, useExportLogAvailable} from 'src/hooks';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {Role, Separator} from 'src/components/backstage/playbook_runs/shared';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {navigateToUrl, pluginUrl} from 'src/browser_routing';

import {useOnFinishRun} from './finish_run';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
}

export const ContextMenu = ({playbookRun, role}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(playbookRun.id);

    const exportAvailable = useExportLogAvailable();
    const allowChannelExport = useAllowChannelExport();
    const [showModal, setShowModal] = useState(false);

    const onExportClick = () => {
        if (!allowChannelExport) {
            setShowModal(true);
            return;
        }

        window.location.href = exportChannelUrl(playbookRun.channel_id);
    };

    const onFinishRun = useOnFinishRun(playbookRun);

    return (
        <>
            <DotMenu
                dotMenuButton={TitleButton}
                placement='bottom-start'
                icon={
                    <>
                        <Title>{playbookRun.name}</Title>
                        <i className={'icon icon-chevron-down'}/>
                    </>
                }
            >
                <DropdownMenuItem
                    onClick={() => {
                        copyToClipboard(getSiteUrl() + '/playbooks/runs/' + playbookRun?.id);
                        addToast(formatMessage({defaultMessage: 'Copied!'}));
                    }}
                >
                    <FormattedMessage defaultMessage='Copy link'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => dispatch(showRunActionsModal())}
                >
                    <FormattedMessage defaultMessage='Run actions'/>
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!exportAvailable}
                    disabledAltText={formatMessage({defaultMessage: 'Install and enable the Channel Export plugin to support exporting the channel'})}
                    onClick={onExportClick}
                >
                    <FormattedMessage defaultMessage='Export channel log'/>
                </DropdownMenuItem>
                {
                    playbookRunIsActive(playbookRun) && role === Role.Participant &&
                        <>
                            <Separator/>
                            <DropdownMenuItem
                                onClick={onFinishRun}
                            >
                                <FormattedMessage defaultMessage='Finish run'/>
                            </DropdownMenuItem>
                        </>
                }
                {
                    role === Role.Participant &&
                    <>
                        <Separator/>
                        <StyledDropdownMenuItemRed onClick={showLeaveRunConfirm}>
                            <FormattedMessage defaultMessage='Leave run'/>
                        </StyledDropdownMenuItemRed>
                    </>
                }
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

const useLeaveRun = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const addToast = useToaster().add;
    const [showLeaveRunConfirm, setLeaveRunConfirm] = useState(false);

    const onLeaveRun = async () => {
        const response = await leaveRun(playbookRunId);
        if (response?.error) {
            addToast(formatMessage({defaultMessage: 'It was not possible to leave the run.'}), ToastType.Failure);
        } else {
            addToast(formatMessage({defaultMessage: 'You have successfully left the run.'}), ToastType.Success);
            if (!response.has_view_permission) {
                navigateToUrl(pluginUrl(''));
            }
        }
    };
    const leaveRunConfirmModal = (
        <ConfirmModal
            show={showLeaveRunConfirm}
            title={formatMessage({defaultMessage: 'Confirm leave'})}
            message={formatMessage({defaultMessage: 'Are you sure you want to leave the run?'})}
            confirmButtonText={formatMessage({defaultMessage: 'Leave'})}
            onConfirm={() => {
                onLeaveRun();
                setLeaveRunConfirm(false);
            }}
            onCancel={() => setLeaveRunConfirm(false)}
        />
    );

    return {
        leaveRunConfirmModal,
        showLeaveRunConfirm: () => {
            setLeaveRunConfirm(true);
        },
    };
};

const StyledDropdownMenuItemRed = styled(DropdownMenuItem)`
 && {
    color: var(--dnd-indicator);

    :hover {
        background: var(--dnd-indicator);
        color: var(--button-color);
    }    
}    
`;

const Title = styled.h1`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 16px;
    line-height: 24px;
    margin: 0;
    white-space: nowrap;
    `;

export const TitleButton = styled.div<{isActive: boolean}>`
    padding: 2px 2px 2px 6px;
    display: inline-flex;
    border-radius: 4px;
    color: ${({isActive}) => (isActive ? 'var(--button-bg)' : 'var(--center-channel-color)')};
    background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'auto')};

    &:hover {
        background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;
