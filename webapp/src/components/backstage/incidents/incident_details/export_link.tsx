// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FC, useState} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from 'mattermost-redux/types/store';
import styled from 'styled-components';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import {OVERLAY_DELAY} from 'src/constants';
import {isExportLicensed} from 'src/selectors';
import {exportChannelUrl} from 'src/client';

import {Incident} from 'src/types/incident';
import {Banner} from 'src/components/backstage/styles';
import {SecondaryButtonLarger} from 'src/components/backstage/incidents/shared';

interface ExportLinkProps {
    incident: Incident
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

const ExportLink: FC<ExportLinkProps> = (props: ExportLinkProps) => {
    //@ts-ignore plugins state is a thing
    const exportAvailable = useSelector<GlobalState, boolean>((state) => Boolean(state.plugins?.plugins?.['com.mattermost.plugin-channel-export']));
    const exportLicensed = useSelector<GlobalState, boolean>(isExportLicensed);

    const [showBanner, setShowBanner] = useState(false);

    const onExportClick = () => {
        window.location.href = exportChannelUrl(props.incident.channel_id);
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
