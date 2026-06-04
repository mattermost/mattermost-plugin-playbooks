// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';

interface Props {
    autoArchive: boolean;
    isLinkedChannel: boolean;
    onChange: (updated: {auto_archive_channel: boolean}) => void;
    disabled?: boolean;
}

const AutoArchiveToggle = ({autoArchive, isLinkedChannel, onChange, disabled}: Props) => {
    const {formatMessage} = useIntl();

    const isDisabled = disabled || isLinkedChannel;

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => {
        if (isLinkedChannel && autoArchive) {
            onChangeRef.current({auto_archive_channel: false});
        }
    }, [isLinkedChannel, autoArchive]);

    const handleChange = useCallback(() => {
        onChange({auto_archive_channel: !autoArchive});
    }, [autoArchive, onChange]);

    const toggle = (
        <Toggle
            disabled={isDisabled}
            isChecked={isLinkedChannel ? false : autoArchive}
            onChange={handleChange}
        >
            {formatMessage({defaultMessage: 'Auto-archive channel'})}
        </Toggle>
    );

    return (
        <>
            {isLinkedChannel ? (
                <WithTooltip
                    id='auto-archive-channel-toggle-tooltip'
                    title={formatMessage({defaultMessage: 'The channel cannot be auto-archived when linking to an existing channel.'})}
                >
                    {toggle}
                </WithTooltip>
            ) : toggle}
            {!isLinkedChannel && autoArchive && (
                <ToggleBanner
                    role='status'
                    data-testid='auto-archive-confirmation-banner'
                >
                    {formatMessage({defaultMessage: 'The channel will be auto-archived when the run is finished.'})}
                </ToggleBanner>
            )}
        </>
    );
};

export default AutoArchiveToggle;

const ToggleBanner = styled.div`
    margin-top: 8px;
    padding: 8px 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
`;
