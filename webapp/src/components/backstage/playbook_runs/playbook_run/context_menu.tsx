// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {showRunActionsModal} from 'src/actions';
import {exportChannelUrl, getSiteUrl} from 'src/client';
import {PlaybookRun, playbookRunIsActive} from 'src/types/playbook_run';
import DotMenu, {DropdownMenuItem} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';

import {copyToClipboard} from 'src/utils';
import {useToaster} from '../../toast_banner';
import {useAllowChannelExport, useExportLogAvailable} from 'src/hooks';
import UpgradeModal from '../../upgrade_modal';
import {AdminNotificationType} from 'src/constants';
import {Role} from '../shared';

import {useOnFinishRun} from './finish_run';

interface Props {
    playbookRun: PlaybookRun;
    role: Role;
}

export const ContextMenu = ({playbookRun, role}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const {add: addToast} = useToaster();

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
                        copyToClipboard(getSiteUrl() + '/playbooks/run_details/' + playbookRun?.id);
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
                    <DropdownMenuItem
                        onClick={onFinishRun}
                    >
                        <FormattedMessage defaultMessage='Finish run'/>
                    </DropdownMenuItem>
                }
            </DotMenu>
            <UpgradeModal
                messageType={AdminNotificationType.EXPORT_CHANNEL}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
        </>
    );
};

const Title = styled.h1`
    ${SemiBoldHeading}
    letter-spacing: -0.01em;
    font-size: 16px;
    line-height: 24px;
    margin: 0;
    white-space: nowrap;
    `;

export const TitleButton = styled.div<{isActive: boolean}>`
    /* padding-left: 16px; */
    padding: 2px 2px 2px 6px;
    display: inline-flex;
    border-radius: 4px;
    color: ${({isActive}) => (isActive ? 'var(--button-bg)' : 'var(--center-channel-color)')};
    background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'auto')};

    &:hover {
        background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;
