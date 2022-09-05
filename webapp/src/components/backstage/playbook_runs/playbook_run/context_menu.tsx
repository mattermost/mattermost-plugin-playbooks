// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-webapp/packages/mattermost-redux/src/selectors/entities/users';
import {StarIcon, StarOutlineIcon, LightningBoltOutlineIcon, LinkVariantIcon, ArrowDownIcon, FlagOutlineIcon, CloseIcon} from '@mattermost/compass-icons/components';

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
import {useLHSRefresh} from '../../lhs_navigation';

import {useOnFinishRun} from './finish_run';
import {useOnRestoreRun} from './restore_run';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
    isFavoriteRun: boolean;
    isFollowing: boolean;
    toggleFavorite: () => void;
}

export const ContextMenu = ({playbookRun, role, isFavoriteRun, isFollowing, toggleFavorite}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();
    const {leaveRunConfirmModal, showLeaveRunConfirm} = useLeaveRun(playbookRun, isFollowing);
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
    const onRestoreRun = useOnRestoreRun(playbookRun);

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
                <StyledDropdownMenuItem onClick={toggleFavorite}>
                    {isFavoriteRun ? (
                        <><StarOutlineIcon size={18}/>{formatMessage({defaultMessage: 'Unfavorite'})}</>
                    ) : (
                        <><StarIcon size={18}/>{formatMessage({defaultMessage: 'Favorite'})}</>
                    )}
                </StyledDropdownMenuItem>
                <Separator/>

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

const useLeaveRun = (playbookRun: PlaybookRun, isFollowing: boolean) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const addToast = useToaster().add;
    const [showLeaveRunConfirm, setLeaveRunConfirm] = useState(false);
    const refreshLHS = useLHSRefresh();

    const onLeaveRun = async () => {
        const response = await leaveRun(playbookRun.id);
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
        />
    );

    return {
        leaveRunConfirmModal,
        showLeaveRunConfirm: () => {
            if (currentUserId === playbookRun.owner_user_id) {
                addToast(formatMessage({defaultMessage: 'Assign a new owner before you leave the run.'}), ToastType.Failure);
                return;
            }
            setLeaveRunConfirm(true);
        },
    };
};

const StyledDropdownMenuItem = styled(DropdownMenuItem)`
    display: flex;
    align-items: center;

    svg {
        margin-right: 11px;
        fill: rgb(var(--center-channel-color-rgb), 0.56);
    }
`;
const StyledDropdownMenuItemRed = styled(StyledDropdownMenuItem)`
    && {
        color: var(--dnd-indicator);

        :hover {
            background: var(--dnd-indicator);
            color: var(--button-color);
        }
    }
    svg{
        fill: var(--dnd-indicator);
        :hover {
            fill: var(--button-color);
        }
    }
`;

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
