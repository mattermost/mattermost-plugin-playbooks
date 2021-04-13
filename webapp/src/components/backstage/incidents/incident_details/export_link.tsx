// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';

import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {OVERLAY_DELAY} from 'src/constants';

import {isExportLicensed} from 'src/selectors';
import {exportChannelUrl} from 'src/client';

import {Incident} from 'src/types/incident';
import {Banner} from 'src/components/backstage/styles';

interface ExportLinkProps {
    incident: Incident
}

const ExportBannerTimeout = 2500;

const ExportLink: FC<ExportLinkProps> = (props: ExportLinkProps) => {
    //@ts-ignore plugins state is a thing
    const exportAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
    const exportLicensed = useSelector<GlobalState, boolean>(isExportLicensed);

    const [showBanner, setShowBanner] = useState(false);

    const onExportClick = () => {
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
            {'Export Channel Log'}
        </>
    );

    let link = (
        <a
            className={'export-link'}
            href={exportChannelUrl(props.incident.channel_id)}
            target={'_new'}
            onClick={onExportClick}
        >
            {linkText}
        </a>
    );
    if (!exportAvailable || !exportLicensed) {
        link = (
            <div className={'disabled'}>
                {linkText}
            </div>
        );
    }

    let tooltip = (
        <Tooltip id='export'>
            {'Download a CSV containing all messages from the incident channel'}
        </Tooltip>
    );

    if (!exportAvailable) {
        tooltip = (
            <Tooltip id='exportUnavailable'>
                {'Install and enable the Channel Export plugin to support exporting this incident'}
            </Tooltip>
        );
    } else if (!exportLicensed) {
        tooltip = (
            <Tooltip id='exportUnlicensed'>
                {'Exporting an incident channel requires a Mattermost Enterprise E20 license'}
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
