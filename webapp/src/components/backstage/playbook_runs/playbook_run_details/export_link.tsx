// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import styled from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {PlaybookRun} from 'src/types/playbook_run';

import {SecondaryButtonLarger} from 'src/components/backstage/playbook_runs/shared';

import {OVERLAY_DELAY} from 'src/constants';
import {isExportLicensed} from 'src/selectors';
import {exportChannelUrl} from 'src/client';

import {Banner} from 'src/components/backstage/styles';

interface ExportLinkProps {
    playbookRun: PlaybookRun
}

const ExportBannerTimeout = 2500;

const SecondaryButtonWithSpace = styled(SecondaryButtonLarger)`
    margin: 0 0 0 20px;
`;

const SecondaryButtonDisabled = styled(SecondaryButtonWithSpace)`
    cursor: default;
    border: 1px solid rgba(var(--button-bg-rgb), 0.50);
    color: rgba(var(--button-bg-rgb), 0.50);

    &:hover {
        background: inherit;
    }
`;

const ExportLink = (props: ExportLinkProps) => {
    //@ts-ignore plugins state is a thing
    const exportAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
    const exportLicensed = useSelector<GlobalState, boolean>(isExportLicensed);

    const [showBanner, setShowBanner] = useState(false);

    const onExportClick = () => {
        window.location.href = exportChannelUrl(props.playbookRun.channel_id);
        setShowBanner(true);
        window.setTimeout(() => {
            setShowBanner(false);
        }, ExportBannerTimeout);
    };

    const downloadStartedBanner = showBanner && (
        <Banner>
            <i className='icon icon-download-outline mr-1'/>
            {'Downloading channel log'}
        </Banner>
    );

    const linkText = (
        <>
            <i className='icon icon-download-outline export-icon'/>
            {'Export channel log'}
        </>
    );

    let link = (
        <SecondaryButtonWithSpace onClick={onExportClick}>
            {linkText}
        </SecondaryButtonWithSpace>
    );
    if (!exportAvailable || !exportLicensed) {
        link = (
            <SecondaryButtonDisabled>
                {linkText}
            </SecondaryButtonDisabled>
        );
    }

    let tooltip = (
        <Tooltip id='export'>
            {'Download a CSV containing all messages from the channel'}
        </Tooltip>
    );

    if (!exportAvailable) {
        tooltip = (
            <Tooltip id='exportUnavailable'>
                {'Install and enable the Channel Export plugin to support exporting the channel'}
            </Tooltip>
        );
    } else if (!exportLicensed) {
        tooltip = (
            <Tooltip id='exportUnlicensed'>
                {'Exporting a channel requires a Mattermost Enterprise license'}
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
        </>
    );
};

export default ExportLink;
