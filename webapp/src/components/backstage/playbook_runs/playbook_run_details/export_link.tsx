// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import styled from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {useIntl} from 'react-intl';

import {PlaybookRun} from 'src/types/playbook_run';

import {SecondaryButtonLarger} from 'src/components/backstage/playbook_runs/shared';

import {OVERLAY_DELAY, AdminNotificationType} from 'src/constants';
import {useAllowChannelExport} from 'src/hooks';
import {exportChannelUrl} from 'src/client';

import {Banner} from 'src/components/backstage/styles';
import UpgradeModal from 'src/components/backstage/upgrade_modal';
import UpgradeBadge from 'src/components/backstage/upgrade_badge';

interface ExportLinkProps {
    playbookRun: PlaybookRun
}

const ExportBannerTimeout = 2500;

const SecondaryButtonWithSpace = styled(SecondaryButtonLarger)`
    margin: 0 0 0 12px;
`;

const SecondaryButtonDisabled = styled(SecondaryButtonWithSpace)`
    cursor: default;
    border: 1px solid rgba(var(--button-bg-rgb), 0.50);
    color: rgba(var(--button-bg-rgb), 0.50);

    &:hover {
        background: inherit;
    }
`;

const PositionedUpgradeBadge = styled(UpgradeBadge)`
    margin-left: -11px;
    margin-top: -29px;
`;

const ExportLink = (props: ExportLinkProps) => {
    //@ts-ignore plugins state is a thing
    const exportAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
    const allowChannelExport = useAllowChannelExport();
    const {formatMessage} = useIntl();
    const [showModal, setShowModal] = useState(false);

    const [showBanner, setShowBanner] = useState(false);

    const onExportClick = () => {
        if (!allowChannelExport) {
            setShowModal(true);
            return;
        }

        window.location.href = exportChannelUrl(props.playbookRun.channel_id);
        setShowBanner(true);
        window.setTimeout(() => {
            setShowBanner(false);
        }, ExportBannerTimeout);
    };

    const downloadStartedBanner = showBanner && (
        <Banner>
            <i className='icon icon-download-outline mr-1'/>
            {formatMessage({defaultMessage: 'Downloading channel log'})}
        </Banner>
    );

    const linkText = (
        <>
            <i className='icon icon-download-outline export-icon'/>
            {formatMessage({defaultMessage: 'Export channel log'})}
        </>
    );

    let link = (
        <SecondaryButtonWithSpace onClick={onExportClick}>
            {linkText}
        </SecondaryButtonWithSpace>
    );
    if (!exportAvailable) {
        link = (
            <SecondaryButtonDisabled>
                {linkText}
            </SecondaryButtonDisabled>
        );
    }

    let tooltip = (
        <Tooltip id='export'>
            {formatMessage({defaultMessage: 'Download a CSV containing all messages from the channel'})}
        </Tooltip>
    );

    if (!exportAvailable) {
        tooltip = (
            <Tooltip id='exportUnavailable'>
                {formatMessage({defaultMessage: 'Install and enable the Channel Export plugin to support exporting the channel'})}
            </Tooltip>
        );
    }

    return (
        <>
            {downloadStartedBanner}
            <OverlayTrigger
                placement='bottom'
                delay={OVERLAY_DELAY}
                overlay={tooltip}
            >
                {link}
            </OverlayTrigger>
            {!allowChannelExport && <PositionedUpgradeBadge/>}
            <UpgradeModal
                messageType={AdminNotificationType.EXPORT_CHANNEL}
                show={showModal}
                onHide={() => setShowModal(false)}
            />
        </>
    );
};

export default ExportLink;
